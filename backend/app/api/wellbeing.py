import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from supabase import create_client
from app.config import settings
from app.api.auth import get_current_user_id
from app.services.ai_engine import call_haiku, parse_json_response
from app.prompts.wellbeing import get_wellbeing_prompt

logger = logging.getLogger(__name__)

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


class WellbeingCheckinRequest(BaseModel):
    mood: str = Field(..., pattern="^(great|okay|stressed|burnt_out)$")
    energy_level: str = Field(..., pattern="^(high|medium|low)$")


@router.post("/api/sessions/{session_id}/checkin")
async def create_wellbeing_checkin(
    session_id: str,
    data: WellbeingCheckinRequest,
    authorization: str = Header(...),
):
    """Record a wellbeing check-in and get session adaptation recommendation."""
    try:
        user_id = await get_current_user_id(authorization)

        # Build session context from the session record
        session_result = supabase.table("sessions").select("*").eq(
            "id", session_id
        ).single().execute()

        if not session_result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        session_context = {
            "session_id": session_id,
            "project_id": session_result.data.get("project_id"),
            "session_type": session_result.data.get("session_type"),
        }

        # Call Claude Haiku for wellbeing-based adaptation
        system_prompt, user_message = get_wellbeing_prompt(
            mood=data.mood,
            energy_level=data.energy_level,
            session_context=session_context,
        )

        ai_response = call_haiku(system_prompt, user_message, max_tokens=512)
        recommendation = parse_json_response(ai_response)

        if not recommendation:
            recommendation = {
                "recommendation": "Continue with your planned session.",
                "session_type": "full_session",
                "reduce_difficulty": False,
                "suggest_break": False,
            }

        # Store the check-in record
        checkin_record = {
            "user_id": user_id,
            "session_id": session_id,
            "mood": data.mood,
            "energy_level": data.energy_level,
            "recommendation": recommendation.get("recommendation", ""),
            "session_type": recommendation.get("session_type", "full_session"),
            "reduce_difficulty": recommendation.get("reduce_difficulty", False),
            "suggest_break": recommendation.get("suggest_break", False),
            "checked_in_at": datetime.utcnow().isoformat(),
        }

        supabase.table("wellbeing_checkins").insert(checkin_record).execute()

        return {
            "checkin": checkin_record,
            "adaptation": recommendation,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating wellbeing check-in: {e}")
        raise HTTPException(status_code=500, detail="Failed to process wellbeing check-in")


@router.get("/api/users/wellbeing/history")
async def get_wellbeing_history(authorization: str = Header(...)):
    """Get the current user's wellbeing check-in history."""
    try:
        user_id = await get_current_user_id(authorization)

        result = supabase.table("wellbeing_checkins").select("*").eq(
            "user_id", user_id
        ).order("checked_in_at", desc=True).limit(20).execute()

        return {"checkins": result.data if result.data else []}
    except Exception as e:
        logger.error(f"Error fetching wellbeing history: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch wellbeing history")
