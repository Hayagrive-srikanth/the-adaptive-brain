import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from supabase import create_client
from app.config import settings

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

# Achievement definitions with XP rewards
ACHIEVEMENT_DEFINITIONS = {
    "first_session": {
        "name": "First Steps",
        "description": "Complete your first study session",
        "xp_award": 50,
    },
    "streak_3": {
        "name": "On a Roll",
        "description": "Maintain a 3-day study streak",
        "xp_award": 100,
    },
    "streak_7": {
        "name": "Week Warrior",
        "description": "Maintain a 7-day study streak",
        "xp_award": 250,
    },
    "streak_30": {
        "name": "Monthly Master",
        "description": "Maintain a 30-day study streak",
        "xp_award": 1000,
    },
    "topic_mastered": {
        "name": "Topic Master",
        "description": "Achieve mastery in a topic",
        "xp_award": 200,
    },
    "five_topics": {
        "name": "Knowledge Explorer",
        "description": "Master 5 different topics",
        "xp_award": 500,
    },
    "perfect_quiz": {
        "name": "Flawless",
        "description": "Get a perfect score on a quiz",
        "xp_award": 150,
    },
    "night_owl": {
        "name": "Night Owl",
        "description": "Complete a session after 10 PM",
        "xp_award": 75,
    },
    "early_bird": {
        "name": "Early Bird",
        "description": "Complete a session before 7 AM",
        "xp_award": 75,
    },
    "marathon": {
        "name": "Marathon Learner",
        "description": "Study for over 2 hours in a single session",
        "xp_award": 300,
    },
    "speed_demon": {
        "name": "Speed Demon",
        "description": "Answer 10 questions correctly in under 5 minutes",
        "xp_award": 200,
    },
    "comeback": {
        "name": "The Comeback",
        "description": "Return after 7+ days of inactivity",
        "xp_award": 100,
    },
}


def calculate_session_xp(session_id: str) -> Dict[str, Any]:
    """
    Calculate XP earned for a completed study session.

    - Base XP: 10 per topic covered
    - Accuracy bonus: +5 per correct answer
    - Streak multiplier: consecutive correct answers multiply bonus (2x, 3x, max 5x),
      resets on wrong answer
    - Consistency bonus: +20 if daily goal met
    """
    try:
        # Fetch session data
        session_result = (
            supabase.table("study_sessions")
            .select("*")
            .eq("id", session_id)
            .single()
            .execute()
        )
        session = session_result.data
        if not session:
            raise ValueError(f"Session {session_id} not found")

        user_id = session.get("user_id") or session.get("project_id")

        # Count topics covered in this session
        topics_result = (
            supabase.table("session_topics")
            .select("*")
            .eq("session_id", session_id)
            .execute()
        )
        topics_covered = len(topics_result.data) if topics_result.data else 0
        base_xp = topics_covered * 10

        # Fetch quiz answers for this session, ordered by creation time
        answers_result = (
            supabase.table("quiz_answers")
            .select("*")
            .eq("session_id", session_id)
            .order("created_at")
            .execute()
        )
        answers = answers_result.data if answers_result.data else []

        # Calculate accuracy bonus with streak multiplier
        accuracy_xp = 0
        consecutive_correct = 0
        max_streak_multiplier = 5

        for answer in answers:
            if answer.get("is_correct"):
                consecutive_correct += 1
                multiplier = min(consecutive_correct, max_streak_multiplier)
                accuracy_xp += 5 * multiplier
            else:
                consecutive_correct = 0

        # Check consistency bonus (daily goal met)
        consistency_bonus = 0
        if user_id:
            goal_result = (
                supabase.table("user_settings")
                .select("daily_xp_goal")
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            daily_goal = (
                goal_result.data.get("daily_xp_goal", 100)
                if goal_result.data
                else 100
            )

            today = date.today().isoformat()
            today_xp_result = (
                supabase.table("xp_history")
                .select("xp_earned")
                .eq("user_id", user_id)
                .gte("earned_at", today)
                .execute()
            )
            today_xp = sum(
                row.get("xp_earned", 0)
                for row in (today_xp_result.data or [])
            )

            total_session_xp = base_xp + accuracy_xp
            if today_xp + total_session_xp >= daily_goal:
                consistency_bonus = 20

        total_xp = base_xp + accuracy_xp + consistency_bonus

        # Record XP in history
        if user_id:
            supabase.table("xp_history").insert(
                {
                    "user_id": user_id,
                    "session_id": session_id,
                    "xp_earned": total_xp,
                    "breakdown": {
                        "base_xp": base_xp,
                        "accuracy_xp": accuracy_xp,
                        "consistency_bonus": consistency_bonus,
                    },
                }
            ).execute()

            # Update total XP on user profile
            profile_result = (
                supabase.table("user_profiles")
                .select("total_xp, level")
                .eq("user_id", user_id)
                .single()
                .execute()
            )
            if profile_result.data:
                new_total = profile_result.data.get("total_xp", 0) + total_xp
                new_level = _calculate_level(new_total)
                supabase.table("user_profiles").update(
                    {"total_xp": new_total, "level": new_level}
                ).eq("user_id", user_id).execute()

        return {
            "session_id": session_id,
            "total_xp": total_xp,
            "base_xp": base_xp,
            "accuracy_xp": accuracy_xp,
            "consistency_bonus": consistency_bonus,
            "topics_covered": topics_covered,
            "answers_count": len(answers),
        }

    except Exception as e:
        logger.error(f"Error calculating session XP: {e}")
        raise


def update_streak(user_id: str) -> Dict[str, Any]:
    """
    Update the user's daily study streak.

    - Check last_active_date vs today
    - If consecutive: increment streak
    - If gap: reset (unless streak freeze available)
    - Update longest_streak if current > longest
    """
    try:
        today = date.today()

        # Fetch current streak data
        streak_result = (
            supabase.table("user_profiles")
            .select(
                "current_streak, longest_streak, last_active_date, streak_freezes"
            )
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        if not streak_result.data:
            # Initialize profile if it doesn't exist
            supabase.table("user_profiles").insert(
                {
                    "user_id": user_id,
                    "current_streak": 1,
                    "longest_streak": 1,
                    "last_active_date": today.isoformat(),
                    "streak_freezes": 0,
                    "total_xp": 0,
                    "level": 1,
                }
            ).execute()
            return {
                "current_streak": 1,
                "longest_streak": 1,
                "streak_maintained": True,
                "freeze_used": False,
                "streak_freezes_remaining": 0,
            }

        profile = streak_result.data
        current_streak = profile.get("current_streak", 0)
        longest_streak = profile.get("longest_streak", 0)
        streak_freezes = profile.get("streak_freezes", 0)
        last_active = profile.get("last_active_date")

        freeze_used = False
        streak_maintained = True

        if last_active:
            last_active_date = date.fromisoformat(last_active)
            days_gap = (today - last_active_date).days

            if days_gap == 0:
                # Already active today, no change needed
                return {
                    "current_streak": current_streak,
                    "longest_streak": longest_streak,
                    "streak_maintained": True,
                    "freeze_used": False,
                    "streak_freezes_remaining": streak_freezes,
                }
            elif days_gap == 1:
                # Consecutive day, increment streak
                current_streak += 1
            elif days_gap == 2 and streak_freezes > 0:
                # One day missed but streak freeze available
                streak_freezes -= 1
                current_streak += 1
                freeze_used = True
            else:
                # Streak broken
                current_streak = 1
                streak_maintained = False
        else:
            current_streak = 1

        # Update longest streak
        if current_streak > longest_streak:
            longest_streak = current_streak

        # Save updated streak data
        supabase.table("user_profiles").update(
            {
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "last_active_date": today.isoformat(),
                "streak_freezes": streak_freezes,
            }
        ).eq("user_id", user_id).execute()

        return {
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "streak_maintained": streak_maintained,
            "freeze_used": freeze_used,
            "streak_freezes_remaining": streak_freezes,
        }

    except Exception as e:
        logger.error(f"Error updating streak for user {user_id}: {e}")
        raise


def check_achievements(
    user_id: str, event_type: str, context: Optional[Dict[str, Any]] = None
) -> List[Dict[str, Any]]:
    """
    Check and award achievements based on an event.

    Returns a list of newly earned achievements with XP awards.
    """
    try:
        context = context or {}
        newly_earned = []

        # Fetch already-earned achievements for this user
        earned_result = (
            supabase.table("user_achievements")
            .select("achievement_key")
            .eq("user_id", user_id)
            .execute()
        )
        earned_keys = {
            row["achievement_key"] for row in (earned_result.data or [])
        }

        # Fetch user profile for streak/stats checks
        profile_result = (
            supabase.table("user_profiles")
            .select("*")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        profile = profile_result.data or {}

        # Determine which achievements to check based on event type
        achievements_to_check = _get_achievements_for_event(
            event_type, profile, context, earned_keys
        )

        # Award new achievements
        for key in achievements_to_check:
            if key in earned_keys:
                continue

            definition = ACHIEVEMENT_DEFINITIONS.get(key)
            if not definition:
                continue

            # Insert achievement record
            supabase.table("user_achievements").insert(
                {
                    "user_id": user_id,
                    "achievement_key": key,
                    "xp_awarded": definition["xp_award"],
                    "context": context,
                }
            ).execute()

            # Award XP
            supabase.table("xp_history").insert(
                {
                    "user_id": user_id,
                    "xp_earned": definition["xp_award"],
                    "breakdown": {"achievement": key},
                }
            ).execute()

            # Update total XP
            current_xp = profile.get("total_xp", 0)
            new_total = current_xp + definition["xp_award"]
            new_level = _calculate_level(new_total)
            supabase.table("user_profiles").update(
                {"total_xp": new_total, "level": new_level}
            ).eq("user_id", user_id).execute()

            # Update local profile for subsequent checks
            profile["total_xp"] = new_total

            newly_earned.append(
                {
                    "key": key,
                    "name": definition["name"],
                    "description": definition["description"],
                    "xp_award": definition["xp_award"],
                }
            )

        return newly_earned

    except Exception as e:
        logger.error(f"Error checking achievements for user {user_id}: {e}")
        raise


def _get_achievements_for_event(
    event_type: str,
    profile: Dict[str, Any],
    context: Dict[str, Any],
    earned_keys: set,
) -> List[str]:
    """Determine which achievements should be checked for a given event."""
    candidates = []
    current_streak = profile.get("current_streak", 0)

    if event_type == "session_complete":
        # First session
        if "first_session" not in earned_keys:
            candidates.append("first_session")

        # Time-based achievements
        hour = context.get("hour", datetime.now().hour)
        if hour >= 22 or hour < 4:
            candidates.append("night_owl")
        if hour < 7:
            candidates.append("early_bird")

        # Marathon: session lasted over 2 hours
        duration_minutes = context.get("duration_minutes", 0)
        if duration_minutes >= 120:
            candidates.append("marathon")

        # Comeback: returned after 7+ days of inactivity
        days_inactive = context.get("days_since_last_active", 0)
        if days_inactive >= 7:
            candidates.append("comeback")

    if event_type == "streak_update":
        if current_streak >= 3:
            candidates.append("streak_3")
        if current_streak >= 7:
            candidates.append("streak_7")
        if current_streak >= 30:
            candidates.append("streak_30")

    if event_type == "quiz_complete":
        # Perfect quiz
        total = context.get("total_questions", 0)
        correct = context.get("correct_answers", 0)
        if total > 0 and correct == total:
            candidates.append("perfect_quiz")

        # Speed demon: 10+ correct in under 5 minutes
        time_seconds = context.get("time_seconds", 0)
        if correct >= 10 and time_seconds > 0 and time_seconds < 300:
            candidates.append("speed_demon")

    if event_type == "topic_mastered":
        candidates.append("topic_mastered")

        # Check total mastered topics for five_topics achievement
        mastered_result = (
            supabase.table("user_topic_mastery")
            .select("id", count="exact")
            .eq("user_id", profile.get("user_id", context.get("user_id", "")))
            .eq("mastered", True)
            .execute()
        )
        mastered_count = mastered_result.count if mastered_result.count else 0
        if mastered_count >= 5:
            candidates.append("five_topics")

    return candidates


def _calculate_level(total_xp: int) -> int:
    """
    Calculate user level from total XP.
    Uses a progressive formula: each level requires more XP than the last.
    Level 1: 0 XP, Level 2: 100 XP, Level 3: 300 XP, Level 4: 600 XP, etc.
    Formula: XP needed for level N = 50 * N * (N - 1)
    """
    level = 1
    while 50 * level * (level + 1) <= total_xp:
        level += 1
    return level
