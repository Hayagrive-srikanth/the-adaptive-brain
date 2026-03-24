import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from supabase import create_client
from app.config import settings
from app.api.auth import get_current_user_id
from app.services.sm2_engine import process_attempt, get_due_cards, create_card

logger = logging.getLogger(__name__)

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


class ReviewAttemptRequest(BaseModel):
    question_id: str
    quality_score: int = Field(..., ge=0, le=5)


@router.get("/api/reviews/due")
async def get_due_reviews(authorization: str = Header(...)):
    """Get all cards due for review today, with joined question data."""
    try:
        user_id = await get_current_user_id(authorization)
        today = datetime.utcnow().date().isoformat()

        cards = get_due_cards(user_id, review_date=today)

        return {"due_cards": cards, "count": len(cards)}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching due reviews: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/reviews/attempt")
async def submit_review_attempt(
    data: ReviewAttemptRequest,
    authorization: str = Header(...),
):
    """
    Submit a review attempt for a spaced repetition card.

    Looks up the card by question_id for the authenticated user,
    then processes the attempt through the SM-2 engine.
    """
    try:
        user_id = await get_current_user_id(authorization)

        # Find the SR card for this user + question
        card_result = supabase.table("spaced_repetition_cards").select("*").eq(
            "user_id", user_id
        ).eq("question_id", data.question_id).single().execute()

        if not card_result.data:
            # Auto-create a card if one doesn't exist yet
            card = create_card(user_id, data.question_id)
            card_id = card["id"]
        else:
            card_id = card_result.data["id"]

        # Optionally fetch exam_date from the user's project
        exam_date = None
        try:
            question = supabase.table("quiz_questions").select(
                "topic_id, topics(project_id, projects(exam_date))"
            ).eq("id", data.question_id).single().execute()

            if question.data:
                topics = question.data.get("topics") or {}
                projects = topics.get("projects") or {}
                exam_date = projects.get("exam_date")
        except Exception:
            # Non-critical — proceed without exam_date compression
            pass

        updated_card = process_attempt(
            card_id=card_id,
            quality_score=data.quality_score,
            exam_date=exam_date,
        )

        return {
            "card": updated_card,
            "quality_score": data.quality_score,
            "next_review_date": updated_card.get("next_review_date"),
        }

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error submitting review attempt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/reviews/stats")
async def get_review_stats(authorization: str = Header(...)):
    """
    Get spaced repetition statistics for the authenticated user.

    Returns:
        cards_due: Number of cards due for review today.
        cards_reviewed_today: Number of cards already reviewed today.
        total_cards: Total number of SR cards for the user.
    """
    try:
        user_id = await get_current_user_id(authorization)
        today = datetime.utcnow().date().isoformat()

        # Cards due today
        due_result = supabase.table("spaced_repetition_cards").select(
            "id", count="exact"
        ).eq("user_id", user_id).lte("next_review_date", today).execute()
        cards_due = due_result.count if due_result.count is not None else 0

        # Cards reviewed today
        today_start = f"{today}T00:00:00"
        reviewed_result = supabase.table("spaced_repetition_cards").select(
            "id", count="exact"
        ).eq("user_id", user_id).gte("last_reviewed_at", today_start).execute()
        cards_reviewed_today = reviewed_result.count if reviewed_result.count is not None else 0

        # Total cards
        total_result = supabase.table("spaced_repetition_cards").select(
            "id", count="exact"
        ).eq("user_id", user_id).execute()
        total_cards = total_result.count if total_result.count is not None else 0

        return {
            "cards_due": cards_due,
            "cards_reviewed_today": cards_reviewed_today,
            "total_cards": total_cards,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching review stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
