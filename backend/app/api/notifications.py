import logging
from fastapi import APIRouter, HTTPException, Header
from supabase import create_client
from app.config import settings
from app.api.auth import get_current_user_id
from app.services.notification_service import get_pending_notifications, mark_opened

logger = logging.getLogger(__name__)

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@router.get("/api/notifications")
async def get_notifications(authorization: str = Header(...)):
    """Get all pending notifications for the current user."""
    try:
        user_id = await get_current_user_id(authorization)
        notifications = get_pending_notifications(user_id)
        return {"notifications": notifications, "count": len(notifications)}
    except Exception as e:
        logger.error(f"Error fetching notifications: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notifications")


@router.post("/api/notifications/{notification_id}/opened")
async def mark_notification_opened(
    notification_id: str,
    authorization: str = Header(...),
):
    """Mark a notification as opened."""
    try:
        user_id = await get_current_user_id(authorization)

        # Verify the notification belongs to this user
        result = supabase.table("notifications").select("user_id").eq(
            "id", notification_id
        ).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Notification not found")

        if result.data["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        updated = mark_opened(notification_id)
        return {"notification": updated}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking notification as opened: {e}")
        raise HTTPException(status_code=500, detail="Failed to update notification")


@router.get("/api/notifications/settings")
async def get_notification_settings(authorization: str = Header(...)):
    """Get notification settings for the current user (placeholder)."""
    try:
        await get_current_user_id(authorization)
        return {"settings": {}}
    except Exception as e:
        logger.error(f"Error fetching notification settings: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notification settings")
