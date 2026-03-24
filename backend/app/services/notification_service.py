import logging
from datetime import datetime
from typing import Optional, List
from supabase import create_client
from app.config import settings

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def create_notification(
    user_id: str,
    type: str,
    title: str,
    body: str,
    project_id: Optional[str] = None,
    question_ids: Optional[List[str]] = None,
    scheduled_at: Optional[str] = None,
) -> dict:
    """Create a new notification for a user.

    Args:
        user_id: The target user's ID.
        type: Notification type (e.g. 'reminder', 'review_due', 'streak', 'gap_alert').
        title: Short notification title.
        body: Notification body text.
        project_id: Optional associated project ID.
        question_ids: Optional list of related question IDs.
        scheduled_at: Optional ISO timestamp for when to deliver. Defaults to now.

    Returns:
        The created notification record.
    """
    try:
        record = {
            "user_id": user_id,
            "type": type,
            "title": title,
            "body": body,
            "project_id": project_id,
            "question_ids": question_ids or [],
            "scheduled_at": scheduled_at or datetime.utcnow().isoformat(),
            "sent": False,
            "opened": False,
        }

        result = supabase.table("notifications").insert(record).execute()
        return result.data[0] if result.data else record
    except Exception as e:
        logger.error(f"Error creating notification: {e}")
        raise


def get_pending_notifications(user_id: str) -> list:
    """Get all unsent notifications for a user, ordered by scheduled time.

    Args:
        user_id: The user's ID.

    Returns:
        List of pending notification records.
    """
    try:
        result = supabase.table("notifications").select("*").eq(
            "user_id", user_id
        ).eq(
            "sent", False
        ).order("scheduled_at").execute()

        return result.data if result.data else []
    except Exception as e:
        logger.error(f"Error fetching pending notifications: {e}")
        return []


def mark_sent(notification_id: str) -> dict:
    """Mark a notification as sent.

    Args:
        notification_id: The notification's ID.

    Returns:
        The updated notification record.
    """
    try:
        result = supabase.table("notifications").update({
            "sent": True,
            "sent_at": datetime.utcnow().isoformat(),
        }).eq("id", notification_id).execute()

        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error(f"Error marking notification as sent: {e}")
        raise


def mark_opened(notification_id: str) -> dict:
    """Mark a notification as opened by the user.

    Args:
        notification_id: The notification's ID.

    Returns:
        The updated notification record.
    """
    try:
        result = supabase.table("notifications").update({
            "opened": True,
            "opened_at": datetime.utcnow().isoformat(),
        }).eq("id", notification_id).execute()

        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error(f"Error marking notification as opened: {e}")
        raise
