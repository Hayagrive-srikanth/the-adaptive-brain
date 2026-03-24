from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from supabase import create_client
from app.config import settings
from app.models.schemas import ProjectCreate, ProjectUpdate
from app.api.auth import get_current_user_id
from app.services.ai_engine import call_sonnet, parse_json_response

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@router.post("/projects")
async def create_project(data: ProjectCreate, authorization: str = Header(...)):
    """Create a new exam project."""
    try:
        user_id = await get_current_user_id(authorization)

        result = supabase.table("projects").insert({
            "user_id": user_id,
            "name": data.name,
            "exam_date": data.exam_date,
            "hours_per_day": data.hours_per_day,
            "comfort_level": data.comfort_level,
        }).execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create project")

        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects")
async def list_projects(authorization: str = Header(...)):
    """List all projects for the current user."""
    try:
        user_id = await get_current_user_id(authorization)

        result = supabase.table("projects").select("*").eq(
            "user_id", user_id
        ).neq("status", "archived").order("created_at", desc=True).execute()

        return {"projects": result.data or []}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}")
async def get_project(project_id: str, authorization: str = Header(...)):
    """Get project details with topic summary."""
    try:
        user_id = await get_current_user_id(authorization)

        project = supabase.table("projects").select("*").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        # Get topic summary
        topics = supabase.table("topics").select(
            "id, name, difficulty, mastery_percentage, status, path_order"
        ).eq("project_id", project_id).order("path_order").execute()

        # Get material count
        materials = supabase.table("source_materials").select(
            "id, processing_status"
        ).eq("project_id", project_id).execute()

        project_data = project.data
        project_data["topics"] = topics.data or []
        project_data["materials_count"] = len(materials.data or [])
        project_data["materials_processed"] = sum(
            1 for m in (materials.data or []) if m["processing_status"] == "completed"
        )

        return project_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/projects/{project_id}")
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    authorization: str = Header(...),
):
    """Update project details."""
    try:
        user_id = await get_current_user_id(authorization)

        # Verify ownership
        existing = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Project not found")

        update_data = {k: v for k, v in data.dict().items() if v is not None}
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        result = supabase.table("projects").update(update_data).eq(
            "id", project_id
        ).execute()

        return result.data[0] if result.data else {}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/projects/{project_id}")
async def archive_project(project_id: str, authorization: str = Header(...)):
    """Archive a project (soft delete)."""
    try:
        user_id = await get_current_user_id(authorization)

        existing = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Project not found")

        supabase.table("projects").update({
            "status": "archived",
        }).eq("id", project_id).execute()

        return {"message": "Project archived"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Phase 3: Exam Eve, Post-Exam, Study Wrapped
# ============================================

class PostExamReflection(BaseModel):
    how_it_went: str
    grade: Optional[str] = None
    difficulty_rating: Optional[int] = None
    notes: Optional[str] = None


@router.get("/projects/{project_id}/exam-eve")
async def get_exam_eve_summary(project_id: str, authorization: str = Header(...)):
    """Get an exam eve summary with stats, readiness, and encouragement.

    Returns total study hours, topics mastered, readiness score,
    and a personalized encouragement message from Claude.
    """
    try:
        user_id = await get_current_user_id(authorization)

        # Verify ownership and get project
        project = supabase.table("projects").select("*").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        project_data = project.data

        # Get all topics with mastery
        topics = supabase.table("topics").select(
            "id, name, mastery_percentage, status, difficulty"
        ).eq("project_id", project_id).execute()

        topic_list = topics.data or []
        total_topics = len(topic_list)
        mastered = sum(1 for t in topic_list if t.get("mastery_percentage", 0) >= 80)
        in_progress = sum(1 for t in topic_list if 0 < t.get("mastery_percentage", 0) < 80)
        not_started = sum(1 for t in topic_list if t.get("mastery_percentage", 0) == 0)
        avg_mastery = (
            sum(t.get("mastery_percentage", 0) for t in topic_list) / total_topics
            if total_topics > 0 else 0
        )

        # Get study session hours
        sessions = supabase.table("study_sessions").select(
            "duration_minutes"
        ).eq("project_id", project_id).execute()

        total_minutes = sum(s.get("duration_minutes", 0) for s in (sessions.data or []))
        total_hours = round(total_minutes / 60, 1)

        # Get mock exam history
        exams = supabase.table("mock_exams").select(
            "percentage, grade"
        ).eq("project_id", project_id).eq("status", "scored").execute()

        exam_scores = [e.get("percentage", 0) for e in (exams.data or [])]
        best_exam_score = max(exam_scores) if exam_scores else None

        # Generate encouragement message via Claude
        weak_topics = [t["name"] for t in topic_list if t.get("mastery_percentage", 0) < 60]
        strong_topics = [t["name"] for t in topic_list if t.get("mastery_percentage", 0) >= 80]

        encouragement_prompt = (
            "You are a supportive study coach for The Adaptive Brain app. "
            "Write a brief, warm, personalized encouragement message (3-5 sentences) "
            "for a student the night before their exam. Be specific about their progress. "
            "Return JSON: {\"message\": \"...\"}"
        )
        encouragement_context = (
            f"Student stats: {total_hours} hours studied, {mastered}/{total_topics} topics mastered, "
            f"average mastery {avg_mastery:.0f}%. "
            f"Strong topics: {', '.join(strong_topics[:5]) if strong_topics else 'still building'}. "
            f"Weak topics: {', '.join(weak_topics[:5]) if weak_topics else 'none - great job!'}. "
            f"Best mock exam: {best_exam_score}%." if best_exam_score else
            f"Student stats: {total_hours} hours studied, {mastered}/{total_topics} topics mastered, "
            f"average mastery {avg_mastery:.0f}%. "
            f"Strong topics: {', '.join(strong_topics[:5]) if strong_topics else 'still building'}. "
            f"Weak topics: {', '.join(weak_topics[:5]) if weak_topics else 'none - great job!'}. "
            f"No mock exams taken yet."
        )

        encouragement_response = call_sonnet(encouragement_prompt, encouragement_context, max_tokens=512)
        encouragement_data = parse_json_response(encouragement_response)
        encouragement = encouragement_data.get("message", "You've got this! Good luck on your exam!")

        return {
            "project_name": project_data.get("name", ""),
            "exam_date": project_data.get("exam_date"),
            "total_study_hours": total_hours,
            "total_topics": total_topics,
            "topics_mastered": mastered,
            "topics_in_progress": in_progress,
            "topics_not_started": not_started,
            "average_mastery": round(avg_mastery, 1),
            "readiness_score": project_data.get("readiness_score", 0),
            "best_mock_exam_score": best_exam_score,
            "mock_exams_taken": len(exam_scores),
            "encouragement": encouragement,
            "weak_topics": weak_topics[:10],
            "strong_topics": strong_topics[:10],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/post-exam")
async def submit_post_exam_reflection(
    project_id: str,
    data: PostExamReflection,
    authorization: str = Header(...),
):
    """Submit a post-exam reflection with how it went and optional grade."""
    try:
        user_id = await get_current_user_id(authorization)

        # Verify ownership
        project = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        # Store the reflection
        reflection = supabase.table("post_exam_reflections").insert({
            "project_id": project_id,
            "user_id": user_id,
            "how_it_went": data.how_it_went,
            "grade": data.grade,
            "difficulty_rating": data.difficulty_rating,
            "notes": data.notes,
        }).execute()

        # Update project status
        update_data = {"status": "completed"}
        if data.grade:
            update_data["final_grade"] = data.grade

        supabase.table("projects").update(update_data).eq("id", project_id).execute()

        return {
            "message": "Post-exam reflection saved",
            "reflection_id": reflection.data[0]["id"] if reflection.data else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/wrapped")
async def get_study_wrapped(project_id: str, authorization: str = Header(...)):
    """Get Study Wrapped data -- a full stats summary of the study journey."""
    try:
        user_id = await get_current_user_id(authorization)

        # Verify ownership and get project
        project = supabase.table("projects").select("*").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        project_data = project.data

        # Topics stats
        topics = supabase.table("topics").select(
            "id, name, mastery_percentage, status, difficulty"
        ).eq("project_id", project_id).order("mastery_percentage", desc=True).execute()

        topic_list = topics.data or []
        total_topics = len(topic_list)

        # Study sessions stats
        sessions = supabase.table("study_sessions").select(
            "duration_minutes, created_at"
        ).eq("project_id", project_id).order("created_at").execute()

        session_list = sessions.data or []
        total_minutes = sum(s.get("duration_minutes", 0) for s in session_list)
        total_sessions = len(session_list)

        # Calculate streak (consecutive days with sessions)
        study_dates = set()
        for s in session_list:
            if s.get("created_at"):
                date_str = s["created_at"][:10]
                study_dates.add(date_str)

        sorted_dates = sorted(study_dates)
        longest_streak = 0
        current_streak = 1
        for i in range(1, len(sorted_dates)):
            from datetime import datetime, timedelta
            prev = datetime.strptime(sorted_dates[i - 1], "%Y-%m-%d")
            curr = datetime.strptime(sorted_dates[i], "%Y-%m-%d")
            if (curr - prev).days == 1:
                current_streak += 1
            else:
                longest_streak = max(longest_streak, current_streak)
                current_streak = 1
        longest_streak = max(longest_streak, current_streak) if sorted_dates else 0

        # Quiz stats
        quiz_attempts = supabase.table("quiz_attempts").select(
            "correct, question_id"
        ).execute()

        # Filter to this project's questions
        project_question_ids = set()
        for t in topic_list:
            qs = supabase.table("quiz_questions").select("id").eq(
                "topic_id", t["id"]
            ).execute()
            for q in (qs.data or []):
                project_question_ids.add(q["id"])

        project_attempts = [
            a for a in (quiz_attempts.data or [])
            if a.get("question_id") in project_question_ids
        ]
        total_questions_answered = len(project_attempts)
        correct_answers = sum(1 for a in project_attempts if a.get("correct"))
        accuracy = (correct_answers / total_questions_answered * 100) if total_questions_answered > 0 else 0

        # Mock exam stats
        exams = supabase.table("mock_exams").select(
            "percentage, grade, created_at"
        ).eq("project_id", project_id).eq("status", "scored").order("created_at").execute()

        exam_list = exams.data or []
        exam_scores = [e.get("percentage", 0) for e in exam_list]

        # Source materials stats
        materials = supabase.table("source_materials").select(
            "id, file_type"
        ).eq("project_id", project_id).execute()

        material_count = len(materials.data or [])

        # Post-exam reflection
        reflection = supabase.table("post_exam_reflections").select("*").eq(
            "project_id", project_id
        ).order("created_at", desc=True).limit(1).execute()

        reflection_data = reflection.data[0] if reflection.data else None

        # Top and bottom topics
        top_topics = [
            {"name": t["name"], "mastery": t.get("mastery_percentage", 0)}
            for t in topic_list[:5]
        ]
        bottom_topics = [
            {"name": t["name"], "mastery": t.get("mastery_percentage", 0)}
            for t in reversed(topic_list[-5:]) if t.get("mastery_percentage", 0) < 80
        ]

        return {
            "project_name": project_data.get("name", ""),
            "created_at": project_data.get("created_at"),
            "exam_date": project_data.get("exam_date"),
            "final_grade": project_data.get("final_grade"),
            "status": project_data.get("status"),
            "stats": {
                "total_study_hours": round(total_minutes / 60, 1),
                "total_sessions": total_sessions,
                "total_days_studied": len(study_dates),
                "longest_streak_days": longest_streak,
                "total_topics": total_topics,
                "topics_mastered": sum(1 for t in topic_list if t.get("mastery_percentage", 0) >= 80),
                "average_mastery": round(
                    sum(t.get("mastery_percentage", 0) for t in topic_list) / total_topics, 1
                ) if total_topics > 0 else 0,
                "total_questions_answered": total_questions_answered,
                "correct_answers": correct_answers,
                "accuracy_percentage": round(accuracy, 1),
                "mock_exams_taken": len(exam_list),
                "best_mock_score": max(exam_scores) if exam_scores else None,
                "latest_mock_score": exam_scores[-1] if exam_scores else None,
                "score_improvement": (
                    round(exam_scores[-1] - exam_scores[0], 1)
                    if len(exam_scores) >= 2 else None
                ),
                "materials_uploaded": material_count,
            },
            "top_topics": top_topics,
            "topics_to_review": bottom_topics,
            "mock_exam_progression": [
                {"date": e.get("created_at", "")[:10], "percentage": e.get("percentage", 0)}
                for e in exam_list
            ],
            "reflection": {
                "how_it_went": reflection_data.get("how_it_went") if reflection_data else None,
                "grade": reflection_data.get("grade") if reflection_data else None,
            } if reflection_data else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
