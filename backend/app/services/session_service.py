import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from supabase import create_client
from app.config import settings
from app.services.content_service import generate_content_block, get_content_blocks
from app.services.quiz_service import generate_questions, get_questions

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def start_session(
    project_id: str,
    plan_day_id: Optional[str] = None,
    session_type: str = "new_material",
) -> Dict[str, Any]:
    """Start a new study session."""
    try:
        session_data = {
            "project_id": project_id,
            "plan_day_id": plan_day_id,
            "session_type": session_type,
        }

        result = supabase.table("study_sessions").insert(session_data).execute()
        session = result.data[0] if result.data else {}

        # Fetch planned topics for this session
        topics = []
        if plan_day_id:
            day = supabase.table("study_plan_days").select("*").eq(
                "id", plan_day_id
            ).single().execute()
            if day.data and day.data.get("topic_ids"):
                topic_ids = day.data["topic_ids"]
                topics_result = supabase.table("topics").select("*").in_(
                    "id", topic_ids
                ).execute()
                topics = topics_result.data if topics_result.data else []

        session["topics"] = topics
        return session
    except Exception as e:
        logger.error(f"Error starting session: {e}")
        raise


def end_session(
    session_id: str,
    topics_covered: List[str],
) -> Dict[str, Any]:
    """End a study session and generate wrap-up summary."""
    try:
        session = supabase.table("study_sessions").select("*").eq(
            "id", session_id
        ).single().execute()
        session_data = session.data

        started_at = datetime.fromisoformat(session_data["started_at"].replace("Z", "+00:00"))
        ended_at = datetime.utcnow()
        duration = int((ended_at - started_at).total_seconds() / 60)

        # Get quiz results for this session
        attempts = supabase.table("quiz_attempts").select("*").eq(
            "session_id", session_id
        ).execute()
        attempts_data = attempts.data or []

        total_questions = len(attempts_data)
        correct_answers = sum(1 for a in attempts_data if a.get("correct"))
        accuracy = (correct_answers / total_questions * 100) if total_questions > 0 else 0

        # Calculate XP
        base_xp = len(topics_covered) * 10
        accuracy_bonus = correct_answers * 5
        xp_earned = base_xp + accuracy_bonus

        # Get readiness score before
        project = supabase.table("projects").select("readiness_score").eq(
            "id", session_data["project_id"]
        ).single().execute()
        readiness_before = project.data.get("readiness_score", 0) if project.data else 0

        # Update session record
        supabase.table("study_sessions").update({
            "ended_at": ended_at.isoformat(),
            "duration_minutes": duration,
            "topics_covered": topics_covered,
            "completed": True,
            "xp_earned": xp_earned,
        }).eq("id", session_id).execute()

        # Update plan day if applicable
        if session_data.get("plan_day_id"):
            supabase.table("study_plan_days").update({
                "completed": True,
                "actual_minutes": duration,
            }).eq("id", session_data["plan_day_id"]).execute()

        # Update user XP
        _update_user_xp(session_data["project_id"], xp_earned)

        # Get readiness score after
        project_after = supabase.table("projects").select("readiness_score").eq(
            "id", session_data["project_id"]
        ).single().execute()
        readiness_after = project_after.data.get("readiness_score", 0) if project_after.data else 0

        # Get topic names for covered topics
        topics_info = []
        if topics_covered:
            topics_result = supabase.table("topics").select("id, name, mastery_percentage").in_(
                "id", topics_covered
            ).execute()
            topics_info = topics_result.data if topics_result.data else []

        return {
            "session_id": session_id,
            "topics_covered": topics_info,
            "questions_answered": total_questions,
            "correct_answers": correct_answers,
            "accuracy_percentage": accuracy,
            "duration_minutes": duration,
            "xp_earned": xp_earned,
            "readiness_score_before": readiness_before,
            "readiness_score_after": readiness_after,
            "next_day_preview": None,
        }
    except Exception as e:
        logger.error(f"Error ending session: {e}")
        raise


def get_session_content(
    session_id: str,
    topic_id: str,
    user_profile: Dict[str, Any],
) -> Dict[str, Any]:
    """Get or generate content for a topic within a session."""
    try:
        # Check for existing content blocks
        existing = get_content_blocks(topic_id)

        if not existing:
            # Generate summary content
            summary = generate_content_block(topic_id, user_profile, "summary")
            existing = [summary]

        # Get quiz questions
        questions = get_questions(topic_id)
        if not questions:
            questions = generate_questions(topic_id, count=3, user_profile=user_profile)

        return {
            "topic_id": topic_id,
            "content_blocks": existing,
            "quiz_questions": [
                {k: v for k, v in q.items() if k != "correct_answer"}
                for q in questions
            ],
        }
    except Exception as e:
        logger.error(f"Error getting session content: {e}")
        raise


def _update_user_xp(project_id: str, xp_earned: int):
    """Update user's total XP."""
    try:
        project = supabase.table("projects").select("user_id").eq(
            "id", project_id
        ).single().execute()

        if project.data:
            user_id = project.data["user_id"]
            user = supabase.table("users").select("total_xp").eq(
                "id", user_id
            ).single().execute()

            if user.data:
                new_xp = user.data.get("total_xp", 0) + xp_earned
                supabase.table("users").update({
                    "total_xp": new_xp,
                    "last_active_date": datetime.utcnow().date().isoformat(),
                }).eq("id", user_id).execute()
    except Exception as e:
        logger.error(f"Error updating user XP: {e}")
