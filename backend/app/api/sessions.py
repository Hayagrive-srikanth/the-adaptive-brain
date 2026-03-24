from fastapi import APIRouter, HTTPException, Header
from typing import List, Optional
from pydantic import BaseModel
from supabase import create_client
from app.config import settings
from app.api.auth import get_current_user_id
from app.services.session_service import start_session, end_session, get_session_content

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


class StartSessionRequest(BaseModel):
    project_id: str
    plan_day_id: Optional[str] = None


class EndSessionRequest(BaseModel):
    topics_covered: List[str] = []


@router.post("/sessions/start")
async def start_study_session(
    data: StartSessionRequest,
    authorization: str = Header(...),
):
    """Start a new study session."""
    try:
        user_id = await get_current_user_id(authorization)

        # Verify project ownership
        project = supabase.table("projects").select("id").eq(
            "id", data.project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        session = start_session(data.project_id, data.plan_day_id)
        return session
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sessions/{session_id}/end")
async def end_study_session(
    session_id: str,
    data: EndSessionRequest,
    authorization: str = Header(...),
):
    """End a study session and get wrap-up summary."""
    try:
        await get_current_user_id(authorization)

        wrap_up = end_session(session_id, data.topics_covered)
        return wrap_up
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, authorization: str = Header(...)):
    """Get session details."""
    try:
        await get_current_user_id(authorization)

        result = supabase.table("study_sessions").select("*").eq(
            "id", session_id
        ).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Session not found")

        return result.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sessions/{session_id}/content/{topic_id}")
async def get_topic_content(
    session_id: str,
    topic_id: str,
    authorization: str = Header(...),
):
    """Get content for a specific topic in a session."""
    try:
        user_id = await get_current_user_id(authorization)

        # Get user profile
        user = supabase.table("users").select("profile").eq(
            "id", user_id
        ).single().execute()
        user_profile = user.data.get("profile", {}) if user.data else {}

        content = get_session_content(session_id, topic_id, user_profile)
        return content
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/sessions")
async def list_sessions(project_id: str, authorization: str = Header(...)):
    """List all sessions for a project."""
    try:
        user_id = await get_current_user_id(authorization)

        project = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        result = supabase.table("study_sessions").select("*").eq(
            "project_id", project_id
        ).order("started_at", desc=True).execute()

        return {"sessions": result.data or []}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
