from fastapi import APIRouter, HTTPException, Header
from supabase import create_client
from app.config import settings
from app.api.auth import get_current_user_id
from app.models.schemas import QuizAttemptCreate, QuizGenerateRequest
from pydantic import BaseModel
from typing import List, Optional
from app.services.quiz_service import (
    generate_questions,
    evaluate_answer,
    update_mastery,
    get_questions,
    rephrase_question,
    get_question_hint,
    generate_mock_exam,
    score_mock_exam,
)

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@router.post("/topics/{topic_id}/questions/generate")
async def generate_quiz_questions(
    topic_id: str,
    data: QuizGenerateRequest,
    authorization: str = Header(...),
):
    """Generate quiz questions for a topic."""
    try:
        user_id = await get_current_user_id(authorization)

        # Get user profile
        user = supabase.table("users").select("profile").eq(
            "id", user_id
        ).single().execute()
        user_profile = user.data.get("profile", {}) if user.data else {}

        questions = generate_questions(
            topic_id=topic_id,
            count=data.count,
            difficulty=data.difficulty,
            user_profile=user_profile,
        )

        # Strip correct answers from response
        safe_questions = []
        for q in questions:
            safe_q = {k: v for k, v in q.items() if k != "correct_answer"}
            safe_questions.append(safe_q)

        return {"questions": safe_questions}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/topics/{topic_id}/questions")
async def get_topic_questions(topic_id: str, authorization: str = Header(...)):
    """Get existing questions for a topic."""
    try:
        await get_current_user_id(authorization)

        questions = get_questions(topic_id)

        # Strip correct answers
        safe_questions = []
        for q in questions:
            safe_q = {k: v for k, v in q.items() if k != "correct_answer"}
            safe_questions.append(safe_q)

        return {"questions": safe_questions}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quiz/attempt")
async def submit_attempt(data: QuizAttemptCreate, authorization: str = Header(...)):
    """Submit a quiz answer and get feedback."""
    try:
        await get_current_user_id(authorization)

        # Evaluate the answer
        feedback = evaluate_answer(data.question_id, data.user_answer)

        # Store the attempt
        attempt_result = supabase.table("quiz_attempts").insert({
            "question_id": data.question_id,
            "session_id": data.session_id,
            "user_answer": data.user_answer,
            "correct": feedback["correct"],
            "time_taken_seconds": data.time_taken_seconds,
            "hints_used": data.hints_used,
        }).execute()

        attempt_id = attempt_result.data[0]["id"] if attempt_result.data else None

        # Update topic mastery
        question = supabase.table("quiz_questions").select("topic_id").eq(
            "id", data.question_id
        ).single().execute()

        mastery = None
        if question.data:
            mastery = update_mastery(question.data["topic_id"])

        return {
            "correct": feedback["correct"],
            "explanation": feedback["explanation"],
            "correct_answer": feedback.get("correct_answer"),
            "attempt_id": attempt_id,
            "mastery_update": mastery,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/quiz-results")
async def get_quiz_results(session_id: str, authorization: str = Header(...)):
    """Get all quiz results for a session."""
    try:
        await get_current_user_id(authorization)

        result = supabase.table("quiz_attempts").select(
            "*, quiz_questions(question_text, question_type, correct_answer, explanation)"
        ).eq("session_id", session_id).order("attempted_at").execute()

        return {"results": result.data or []}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Phase 2: Rephrase & Hint Endpoints
# ============================================

class RephraseRequest(BaseModel):
    question_id: str
    attempt_count: int


class HintRequest(BaseModel):
    question_id: str
    hint_index: int


@router.post("/quiz/rephrase")
async def rephrase_quiz_question(
    data: RephraseRequest,
    authorization: str = Header(...),
):
    """Get a rephrased explanation and new test question after an incorrect answer.

    Rephrase level is determined by attempt_count:
    - 1: Different wording, same format
    - 2: Switch modality (analogies, simpler vocab)
    - 3+: Full walkthrough from basics
    """
    try:
        user_id = await get_current_user_id(authorization)

        # Get user profile
        user = supabase.table("users").select("profile").eq(
            "id", user_id
        ).single().execute()
        user_profile = user.data.get("profile", {}) if user.data else {}

        result = rephrase_question(
            question_id=data.question_id,
            attempt_count=data.attempt_count,
            user_profile=user_profile,
        )

        # Strip correct answer from new question in response
        new_q = result.get("new_question")
        if new_q and "correct_answer" in new_q:
            safe_q = {k: v for k, v in new_q.items() if k != "correct_answer"}
            result["new_question"] = safe_q

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quiz/hint")
async def get_hint(
    data: HintRequest,
    authorization: str = Header(...),
):
    """Get a specific hint for a question by index."""
    try:
        await get_current_user_id(authorization)

        hint_text = get_question_hint(data.question_id, data.hint_index)

        if hint_text is None:
            raise HTTPException(
                status_code=404,
                detail="Hint not available at this index",
            )

        return {
            "hint_text": hint_text,
            "hint_index": data.hint_index,
            "question_id": data.question_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Phase 3: Mock Exam Endpoints
# ============================================

class MockExamAnswer(BaseModel):
    section_index: int
    question_index: int
    student_answer: str


class MockExamSubmission(BaseModel):
    exam_id: str
    answers: List[MockExamAnswer]


@router.post("/projects/{project_id}/mock-exam/generate")
async def generate_project_mock_exam(
    project_id: str,
    authorization: str = Header(...),
):
    """Generate a full mock exam covering all topics in the project."""
    try:
        user_id = await get_current_user_id(authorization)

        # Verify project ownership
        project = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        # Get user profile
        user = supabase.table("users").select("profile").eq(
            "id", user_id
        ).single().execute()
        user_profile = user.data.get("profile", {}) if user.data else {}

        exam = generate_mock_exam(project_id, user_profile)

        # Strip correct answers from the response sent to the client
        for section in exam.get("sections", []):
            for question in section.get("questions", []):
                question.pop("correct_answer", None)
                question.pop("explanation", None)

        return exam
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/mock-exam/submit")
async def submit_mock_exam(
    project_id: str,
    data: MockExamSubmission,
    authorization: str = Header(...),
):
    """Submit a completed mock exam for scoring."""
    try:
        user_id = await get_current_user_id(authorization)

        # Verify project ownership
        project = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        answers = [a.dict() for a in data.answers]
        result = score_mock_exam(data.exam_id, answers)

        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/mock-exam/results")
async def get_mock_exam_results(
    project_id: str,
    authorization: str = Header(...),
):
    """Get all mock exam results for a project."""
    try:
        user_id = await get_current_user_id(authorization)

        # Verify project ownership
        project = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        results = supabase.table("mock_exams").select(
            "id, created_at, status, score, percentage, grade, "
            "total_points, total_time_minutes, scoring_result"
        ).eq("project_id", project_id).order("created_at", desc=True).execute()

        return {"results": results.data or []}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
