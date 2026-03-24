from fastapi import APIRouter, HTTPException, Header
from supabase import create_client
from app.config import settings
from app.models.schemas import OnboardingRequest, ProfileEditRequest, ProfileEditResponse
from app.services.profile_service import create_profile_from_onboarding, interpret_profile_edit
from app.api.auth import get_current_user_id

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@router.post("/onboarding")
async def complete_onboarding(
    data: OnboardingRequest,
    authorization: str = Header(...),
):
    """Complete onboarding questionnaire and generate user profile."""
    try:
        user_id = await get_current_user_id(authorization)

        answers = [{"question_id": a.question_id, "answer": a.answer} for a in data.answers]
        profile = create_profile_from_onboarding(answers)

        supabase.table("users").update({
            "profile": profile,
            "onboarding_completed": True,
        }).eq("id", user_id).execute()

        return {"profile": profile, "message": "Onboarding completed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/profile")
async def get_profile(authorization: str = Header(...)):
    """Get the current user's profile."""
    try:
        user_id = await get_current_user_id(authorization)

        result = supabase.table("users").select(
            "id, email, name, profile, total_xp, current_streak, longest_streak, onboarding_completed"
        ).eq("id", user_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="User not found")

        return result.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/profile/edit")
async def edit_profile(
    data: ProfileEditRequest,
    authorization: str = Header(...),
):
    """Edit profile using natural language prompt."""
    try:
        user_id = await get_current_user_id(authorization)

        user = supabase.table("users").select("profile").eq(
            "id", user_id
        ).single().execute()

        if not user.data:
            raise HTTPException(status_code=404, detail="User not found")

        current_profile = user.data.get("profile", {})

        result = interpret_profile_edit(user_id, current_profile, data.prompt)

        return ProfileEditResponse(**result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_user_stats(authorization: str = Header(...)):
    """Get user statistics."""
    try:
        user_id = await get_current_user_id(authorization)

        user = supabase.table("users").select(
            "total_xp, current_streak, longest_streak, last_active_date"
        ).eq("id", user_id).single().execute()

        if not user.data:
            raise HTTPException(status_code=404, detail="User not found")

        # Get total study time
        sessions = supabase.table("study_sessions").select(
            "duration_minutes"
        ).eq("completed", True).execute()

        # Filter by user's projects
        projects = supabase.table("projects").select("id").eq("user_id", user_id).execute()
        project_ids = [p["id"] for p in (projects.data or [])]

        total_time = 0
        total_sessions = 0
        total_questions = 0

        if project_ids:
            user_sessions = supabase.table("study_sessions").select(
                "id, duration_minutes"
            ).in_("project_id", project_ids).eq("completed", True).execute()

            total_sessions = len(user_sessions.data or [])
            total_time = sum(s.get("duration_minutes", 0) for s in (user_sessions.data or []))

            session_ids = [s["id"] for s in (user_sessions.data or [])]
            if session_ids:
                attempts = supabase.table("quiz_attempts").select("id").in_(
                    "session_id", session_ids
                ).execute()
                total_questions = len(attempts.data or [])

        return {
            **user.data,
            "total_study_minutes": total_time,
            "total_sessions": total_sessions,
            "total_questions_answered": total_questions,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
