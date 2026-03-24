from fastapi import APIRouter, HTTPException, Depends
from datetime import date
from app.api.auth import get_current_user_id
from app.services.gamification_service import (
    update_streak,
    check_achievements,
    _calculate_level,
)
from supabase import create_client
from app.config import settings

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@router.get("/stats")
async def get_stats(user_id: str = Depends(get_current_user_id)):
    """Get user's gamification stats: XP, streak, daily progress, and level."""
    try:
        # Fetch user profile
        profile_result = (
            supabase.table("user_profiles")
            .select("total_xp, level, current_streak, longest_streak, last_active_date")
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        if not profile_result.data:
            return {
                "total_xp": 0,
                "level": 1,
                "current_streak": 0,
                "longest_streak": 0,
                "daily_xp": 0,
                "daily_goal": 100,
                "daily_progress_percent": 0,
            }

        profile = profile_result.data

        # Fetch daily XP goal
        settings_result = (
            supabase.table("user_settings")
            .select("daily_xp_goal")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        daily_goal = (
            settings_result.data.get("daily_xp_goal", 100)
            if settings_result.data
            else 100
        )

        # Calculate today's XP
        today = date.today().isoformat()
        today_xp_result = (
            supabase.table("xp_history")
            .select("xp_earned")
            .eq("user_id", user_id)
            .gte("earned_at", today)
            .execute()
        )
        daily_xp = sum(
            row.get("xp_earned", 0) for row in (today_xp_result.data or [])
        )

        total_xp = profile.get("total_xp", 0)
        level = profile.get("level", 1)

        # Calculate XP progress within current level
        current_level_xp = 50 * (level - 1) * level
        next_level_xp = 50 * level * (level + 1)
        xp_in_level = total_xp - current_level_xp
        xp_needed = next_level_xp - current_level_xp

        return {
            "total_xp": total_xp,
            "level": level,
            "xp_in_level": xp_in_level,
            "xp_to_next_level": xp_needed,
            "level_progress_percent": round(
                (xp_in_level / xp_needed * 100) if xp_needed > 0 else 0, 1
            ),
            "current_streak": profile.get("current_streak", 0),
            "longest_streak": profile.get("longest_streak", 0),
            "daily_xp": daily_xp,
            "daily_goal": daily_goal,
            "daily_progress_percent": round(
                min((daily_xp / daily_goal * 100) if daily_goal > 0 else 0, 100), 1
            ),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch gamification stats: {str(e)}",
        )


@router.get("/achievements")
async def get_achievements(user_id: str = Depends(get_current_user_id)):
    """Get all achievements earned by the user."""
    try:
        result = (
            supabase.table("user_achievements")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )

        achievements = []
        for row in result.data or []:
            key = row.get("achievement_key", "")
            from app.services.gamification_service import ACHIEVEMENT_DEFINITIONS

            definition = ACHIEVEMENT_DEFINITIONS.get(key, {})
            achievements.append(
                {
                    "key": key,
                    "name": definition.get("name", key),
                    "description": definition.get("description", ""),
                    "xp_awarded": row.get("xp_awarded", 0),
                    "earned_at": row.get("created_at"),
                }
            )

        return {"achievements": achievements, "total_earned": len(achievements)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch achievements: {str(e)}",
        )


@router.get("/daily-goal")
async def get_daily_goal(user_id: str = Depends(get_current_user_id)):
    """Get progress toward today's XP goal."""
    try:
        # Fetch daily goal setting
        settings_result = (
            supabase.table("user_settings")
            .select("daily_xp_goal")
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        daily_goal = (
            settings_result.data.get("daily_xp_goal", 100)
            if settings_result.data
            else 100
        )

        # Calculate today's XP with breakdown
        today = date.today().isoformat()
        today_xp_result = (
            supabase.table("xp_history")
            .select("xp_earned, session_id, breakdown, created_at")
            .eq("user_id", user_id)
            .gte("earned_at", today)
            .order("created_at", desc=True)
            .execute()
        )

        entries = today_xp_result.data or []
        daily_xp = sum(row.get("xp_earned", 0) for row in entries)
        goal_met = daily_xp >= daily_goal

        return {
            "daily_goal": daily_goal,
            "daily_xp": daily_xp,
            "remaining": max(daily_goal - daily_xp, 0),
            "goal_met": goal_met,
            "progress_percent": round(
                min((daily_xp / daily_goal * 100) if daily_goal > 0 else 0, 100), 1
            ),
            "sessions_today": len(
                [e for e in entries if e.get("session_id")]
            ),
            "xp_entries": [
                {
                    "xp": entry.get("xp_earned", 0),
                    "source": entry.get("breakdown", {}),
                    "time": entry.get("created_at"),
                }
                for entry in entries[:10]
            ],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch daily goal progress: {str(e)}",
        )


@router.post("/streak-freeze")
async def use_streak_freeze(user_id: str = Depends(get_current_user_id)):
    """Use a streak freeze to protect the current streak."""
    try:
        # Fetch current profile
        profile_result = (
            supabase.table("user_profiles")
            .select("current_streak, streak_freezes, last_active_date")
            .eq("user_id", user_id)
            .single()
            .execute()
        )

        if not profile_result.data:
            raise HTTPException(status_code=404, detail="User profile not found")

        profile = profile_result.data
        streak_freezes = profile.get("streak_freezes", 0)

        if streak_freezes <= 0:
            raise HTTPException(
                status_code=400,
                detail="No streak freezes available",
            )

        last_active = profile.get("last_active_date")
        today = date.today()

        # Verify the freeze is needed (user missed yesterday)
        if last_active:
            last_active_date = date.fromisoformat(last_active)
            days_gap = (today - last_active_date).days

            if days_gap <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Streak freeze not needed — streak is still active",
                )

            if days_gap > 2:
                raise HTTPException(
                    status_code=400,
                    detail="Streak already broken — freeze can only cover a single missed day",
                )

        # Apply the freeze: decrement freezes, keep streak, update last_active
        supabase.table("user_profiles").update(
            {
                "streak_freezes": streak_freezes - 1,
                "last_active_date": today.isoformat(),
            }
        ).eq("user_id", user_id).execute()

        return {
            "success": True,
            "message": "Streak freeze applied successfully",
            "current_streak": profile.get("current_streak", 0),
            "streak_freezes_remaining": streak_freezes - 1,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to apply streak freeze: {str(e)}",
        )
