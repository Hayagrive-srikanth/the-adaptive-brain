from fastapi import APIRouter, HTTPException, Header
from supabase import create_client
from app.config import settings
from app.api.auth import get_current_user_id
from app.services.study_plan_service import get_active_plan, get_today_plan_day
from app.tasks.generate_plan import generate_study_plan

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@router.post("/projects/{project_id}/plan/generate")
async def generate_plan(project_id: str, authorization: str = Header(...)):
    """Generate a study plan for a project."""
    try:
        user_id = await get_current_user_id(authorization)

        project = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        # Mark any existing active plan as outdated
        supabase.table("study_plans").update({
            "status": "outdated",
        }).eq("project_id", project_id).eq("status", "active").execute()

        task = generate_study_plan.delay(project_id)

        return {"message": "Study plan generation started", "task_id": task.id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/plan")
async def get_plan(project_id: str, authorization: str = Header(...)):
    """Get the active study plan with all days."""
    try:
        user_id = await get_current_user_id(authorization)

        project = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        plan = get_active_plan(project_id)

        if not plan:
            raise HTTPException(status_code=404, detail="No active study plan found")

        return plan
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/plan/today")
async def get_today(project_id: str, authorization: str = Header(...)):
    """Get today's study plan day."""
    try:
        user_id = await get_current_user_id(authorization)

        project = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        today = get_today_plan_day(project_id)

        if not today:
            return {"message": "No study planned for today", "day": None}

        return {"day": today}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
