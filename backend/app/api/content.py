"""Content API endpoints for The Adaptive Brain.

Provides endpoints for generating, listing, and recommending content blocks
for topics.
"""

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
from supabase import create_client
from app.config import settings
from app.api.auth import get_current_user_id
from app.services.content_service import (
    generate_content_block,
    get_content_blocks,
    recommend_formats,
)

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


class ContentGenerateRequest(BaseModel):
    content_type: str


@router.post("/topics/{topic_id}/content/generate")
async def generate_topic_content(
    topic_id: str,
    data: ContentGenerateRequest,
    authorization: str = Header(...),
):
    """Generate a content block of the specified type for a topic."""
    try:
        user_id = await get_current_user_id(authorization)

        # Get user profile
        user = supabase.table("users").select("profile").eq(
            "id", user_id
        ).single().execute()
        user_profile = user.data.get("profile", {}) if user.data else {}

        content = generate_content_block(
            topic_id=topic_id,
            user_profile=user_profile,
            content_type=data.content_type,
        )

        return {"content_block": content}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/topics/{topic_id}/content")
async def list_topic_content(
    topic_id: str,
    authorization: str = Header(...),
):
    """List all content blocks for a topic."""
    try:
        await get_current_user_id(authorization)

        blocks = get_content_blocks(topic_id)
        return {"content_blocks": blocks}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/topics/{topic_id}/content/recommended")
async def get_recommended_content_types(
    topic_id: str,
    authorization: str = Header(...),
):
    """Get recommended content types for a topic based on user profile."""
    try:
        user_id = await get_current_user_id(authorization)

        # Get user profile
        user = supabase.table("users").select("profile").eq(
            "id", user_id
        ).single().execute()
        user_profile = user.data.get("profile", {}) if user.data else {}

        recommended = recommend_formats(topic_id, user_profile)
        return {"recommended_types": recommended}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
