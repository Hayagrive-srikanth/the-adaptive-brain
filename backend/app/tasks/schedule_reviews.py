import logging
from datetime import datetime
from app.celery_app import celery_app
from app.config import settings
from supabase import create_client

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@celery_app.task(bind=True, max_retries=2)
def schedule_review_notifications(self):
    """
    Celery task: check all users with active projects for due SR cards
    and create notification records for users who have reviews pending.
    """
    try:
        today = datetime.utcnow().date().isoformat()

        # Get all users with active (non-archived) projects
        projects_result = supabase.table("projects").select(
            "user_id"
        ).eq("status", "active").execute()

        if not projects_result.data:
            logger.info("No active projects found; skipping review notifications.")
            return {"notified_users": 0}

        # Deduplicate user IDs
        user_ids = list({p["user_id"] for p in projects_result.data})

        notified_count = 0

        for user_id in user_ids:
            try:
                # Check for due cards
                due_result = supabase.table("spaced_repetition_cards").select(
                    "id", count="exact"
                ).eq("user_id", user_id).lte("next_review_date", today).execute()

                due_count = due_result.count if due_result.count is not None else 0

                if due_count == 0:
                    continue

                # Check if we already sent a review notification today
                existing = supabase.table("notifications").select("id").eq(
                    "user_id", user_id
                ).eq("type", "spaced_review").gte(
                    "created_at", f"{today}T00:00:00"
                ).execute()

                if existing.data:
                    # Already notified today
                    continue

                # Create notification
                supabase.table("notifications").insert({
                    "user_id": user_id,
                    "type": "spaced_review",
                    "title": "Reviews Due",
                    "message": f"You have {due_count} card{'s' if due_count != 1 else ''} due for review today.",
                    "read": False,
                }).execute()

                notified_count += 1
                logger.info(f"Created review notification for user {user_id} ({due_count} cards due)")

            except Exception as e:
                logger.error(f"Error processing review notification for user {user_id}: {e}")
                continue

        logger.info(f"Review notification task complete: {notified_count} users notified")
        return {"notified_users": notified_count}

    except Exception as e:
        logger.error(f"Error in schedule_review_notifications: {e}")
        raise self.retry(exc=e, countdown=120)
