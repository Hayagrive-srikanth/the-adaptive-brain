from fastapi import APIRouter, HTTPException, Header
from supabase import create_client
from app.config import settings
from app.api.auth import get_current_user_id
from app.tasks.generate_plan import generate_study_plan
from app.services.knowledge_graph_service import build_graph

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@router.get("/projects/{project_id}/topics")
async def list_topics(project_id: str, authorization: str = Header(...)):
    """List all topics for a project with mastery percentages."""
    try:
        user_id = await get_current_user_id(authorization)

        # Verify ownership
        project = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        result = supabase.table("topics").select("*").eq(
            "project_id", project_id
        ).order("path_order").execute()

        return {
            "topics": result.data or [],
            "total_count": len(result.data or []),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/topics/{topic_id}")
async def get_topic(topic_id: str, authorization: str = Header(...)):
    """Get topic details with content blocks."""
    try:
        await get_current_user_id(authorization)

        topic = supabase.table("topics").select("*").eq(
            "id", topic_id
        ).single().execute()

        if not topic.data:
            raise HTTPException(status_code=404, detail="Topic not found")

        # Get content blocks
        content = supabase.table("content_blocks").select("*").eq(
            "topic_id", topic_id
        ).execute()

        topic_data = topic.data
        topic_data["content_blocks"] = content.data or []

        return topic_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/projects/{project_id}/topics/generate")
async def generate_topics(project_id: str, authorization: str = Header(...)):
    """Trigger topic extraction and study plan generation."""
    try:
        user_id = await get_current_user_id(authorization)

        project = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        # Trigger async task
        task = generate_study_plan.delay(project_id)

        return {
            "message": "Topic extraction and plan generation started",
            "task_id": task.id,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/knowledge-graph")
async def get_knowledge_graph(project_id: str, authorization: str = Header(...)):
    """Get the full knowledge graph data for a project for visualization.

    Returns nodes (topics with mastery) and edges (prerequisite, similarity,
    cross-material relationships).
    """
    try:
        user_id = await get_current_user_id(authorization)

        # Verify ownership
        project = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        graph_data = build_graph(project_id)
        return graph_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
