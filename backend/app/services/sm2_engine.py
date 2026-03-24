import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from supabase import create_client
from app.config import settings

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def calculate_sm2(
    quality: int,
    easiness_factor: float,
    interval: int,
    repetition: int,
    exam_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Calculate the next review parameters using the SM-2 algorithm.

    Args:
        quality: Quality of recall (0-5). 0-2 = fail, 3-5 = pass.
        easiness_factor: Current easiness factor (>= 1.3).
        interval: Current interval in days.
        repetition: Current repetition count.
        exam_date: Optional exam deadline (ISO date string) for interval compression.

    Returns:
        Dict with new easiness_factor, interval, repetition, and next_review_date.
    """
    # Clamp quality to valid range
    quality = max(0, min(5, quality))

    # Update easiness factor
    new_ef = easiness_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)

    if quality >= 3:
        # Successful recall
        if repetition == 0:
            new_interval = 1
        elif repetition == 1:
            new_interval = 6
        else:
            new_interval = round(interval * new_ef)
        new_repetition = repetition + 1
    else:
        # Failed recall — reset
        new_interval = 1
        new_repetition = 0

    next_review_date = datetime.utcnow().date() + timedelta(days=new_interval)

    # Exam-deadline-aware compression
    if exam_date:
        try:
            exam_dt = datetime.fromisoformat(exam_date).date()
            if next_review_date > exam_dt:
                days_until_exam = (exam_dt - datetime.utcnow().date()).days
                if days_until_exam > 0:
                    new_interval = max(1, days_until_exam // 2)
                    next_review_date = datetime.utcnow().date() + timedelta(days=new_interval)
                else:
                    # Exam is today or past — review immediately
                    new_interval = 1
                    next_review_date = datetime.utcnow().date() + timedelta(days=1)
        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid exam_date format '{exam_date}': {e}")

    return {
        "easiness_factor": round(new_ef, 4),
        "interval": new_interval,
        "repetition": new_repetition,
        "next_review_date": next_review_date.isoformat(),
    }


def process_attempt(
    card_id: str,
    quality_score: int,
    exam_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Process a review attempt for a spaced repetition card.

    Fetches the card from the database, recalculates SM-2 parameters,
    updates the card, and returns the updated record.

    Args:
        card_id: UUID of the spaced_repetition_cards row.
        quality_score: Quality of recall (0-5).
        exam_date: Optional exam deadline for interval compression.

    Returns:
        The updated card record.
    """
    try:
        # Fetch current card
        result = supabase.table("spaced_repetition_cards").select("*").eq(
            "id", card_id
        ).single().execute()
        card = result.data

        if not card:
            raise ValueError(f"Card {card_id} not found")

        # Calculate new SM-2 values
        sm2_result = calculate_sm2(
            quality=quality_score,
            easiness_factor=card.get("easiness_factor", 2.5),
            interval=card.get("interval", 1),
            repetition=card.get("repetition", 0),
            exam_date=exam_date,
        )

        # Update the card in the database
        update_data = {
            "easiness_factor": sm2_result["easiness_factor"],
            "interval": sm2_result["interval"],
            "repetition": sm2_result["repetition"],
            "next_review_date": sm2_result["next_review_date"],
            "last_reviewed_at": datetime.utcnow().isoformat(),
            "total_reviews": card.get("total_reviews", 0) + 1,
            "last_quality_score": quality_score,
        }

        updated = supabase.table("spaced_repetition_cards").update(
            update_data
        ).eq("id", card_id).execute()

        if updated.data:
            return updated.data[0]

        logger.error(f"Failed to update card {card_id}")
        raise ValueError(f"Failed to update card {card_id}")

    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Error processing attempt for card {card_id}: {e}")
        raise


def get_due_cards(user_id: str, review_date: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Get all spaced repetition cards due for review.

    Args:
        user_id: UUID of the user.
        review_date: Optional date string (ISO format). Defaults to today.

    Returns:
        List of card records where next_review_date <= review_date.
    """
    try:
        if review_date is None:
            review_date = datetime.utcnow().date().isoformat()

        result = supabase.table("spaced_repetition_cards").select(
            "*, quiz_questions(question_text, question_type, options, difficulty)"
        ).eq(
            "user_id", user_id
        ).lte(
            "next_review_date", review_date
        ).order("next_review_date").execute()

        return result.data if result.data else []

    except Exception as e:
        logger.error(f"Error fetching due cards for user {user_id}: {e}")
        raise


def create_card(user_id: str, question_id: str) -> Dict[str, Any]:
    """
    Create a new spaced repetition card with SM-2 defaults.

    Args:
        user_id: UUID of the user.
        question_id: UUID of the quiz question to attach.

    Returns:
        The newly created card record.
    """
    try:
        tomorrow = (datetime.utcnow().date() + timedelta(days=1)).isoformat()

        result = supabase.table("spaced_repetition_cards").insert({
            "user_id": user_id,
            "question_id": question_id,
            "easiness_factor": 2.5,
            "interval": 1,
            "repetition": 0,
            "next_review_date": tomorrow,
            "total_reviews": 0,
            "last_quality_score": None,
            "last_reviewed_at": None,
        }).execute()

        if result.data:
            return result.data[0]

        raise ValueError("Failed to create spaced repetition card")

    except Exception as e:
        logger.error(f"Error creating SR card for user {user_id}, question {question_id}: {e}")
        raise
