import json
import logging
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
from supabase import create_client
from app.config import settings
from app.services.ai_engine import call_opus, parse_json_response
from app.prompts.study_plan import get_study_plan_prompt
from app.prompts.gap_detection import get_gap_detection_prompt

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def generate_plan(
    project_id: str,
    topics: List[Dict[str, Any]],
    user_profile: Dict[str, Any],
    exam_date: str,
    hours_per_day: float,
    comfort_level: str,
) -> Dict[str, Any]:
    """Generate a study plan using Claude Opus."""
    try:
        exam_dt = datetime.strptime(exam_date, "%Y-%m-%d").date()
        today = date.today()
        total_days = (exam_dt - today).days

        if total_days <= 0:
            total_days = 7  # Default to 7 days if exam date is past

        daily_target_minutes = int(hours_per_day * 60)

        system_prompt, user_message = get_study_plan_prompt(
            topics=topics,
            user_profile=user_profile,
            total_days=total_days,
            hours_per_day=hours_per_day,
            comfort_level=comfort_level,
            exam_date=exam_date,
        )

        response = call_opus(system_prompt, user_message, max_tokens=8192)
        plan_data = parse_json_response(response)

        if not plan_data or "days" not in plan_data:
            logger.error("Failed to parse study plan from AI response")
            plan_data = _generate_fallback_plan(topics, total_days, daily_target_minutes)

        # Create study plan record
        plan_result = supabase.table("study_plans").insert({
            "project_id": project_id,
            "total_days": total_days,
            "daily_target_minutes": daily_target_minutes,
            "status": "active",
        }).execute()

        plan_id = plan_result.data[0]["id"]

        # Create study plan day records
        days_data = plan_data.get("days", [])
        for day in days_data:
            day_date = (today + timedelta(days=day.get("day_number", 1) - 1)).isoformat()
            supabase.table("study_plan_days").insert({
                "plan_id": plan_id,
                "day_number": day.get("day_number", 1),
                "date": day_date,
                "topic_ids": day.get("topic_ids", []),
                "session_type": day.get("session_type", "new_material"),
                "estimated_minutes": day.get("estimated_minutes", daily_target_minutes),
            }).execute()

        return {
            "plan_id": plan_id,
            "total_days": total_days,
            "daily_target_minutes": daily_target_minutes,
            "days": days_data,
        }
    except Exception as e:
        logger.error(f"Error generating study plan: {e}")
        raise


def _generate_fallback_plan(
    topics: List[Dict], total_days: int, daily_target_minutes: int
) -> Dict[str, Any]:
    """Generate a simple fallback plan if AI generation fails."""
    days = []
    topic_ids = [t["id"] for t in topics]
    topics_per_day = max(1, len(topic_ids) // max(1, total_days - 2))

    for day_num in range(1, total_days + 1):
        if day_num >= total_days - 1:
            # Last 2 days are review
            days.append({
                "day_number": day_num,
                "topic_ids": topic_ids,
                "session_type": "review" if day_num == total_days - 1 else "mock_exam",
                "estimated_minutes": daily_target_minutes,
            })
        else:
            start_idx = (day_num - 1) * topics_per_day
            end_idx = min(start_idx + topics_per_day, len(topic_ids))
            day_topics = topic_ids[start_idx:end_idx] if start_idx < len(topic_ids) else []

            days.append({
                "day_number": day_num,
                "topic_ids": day_topics,
                "session_type": "new_material",
                "estimated_minutes": daily_target_minutes,
            })

    return {"days": days}


def get_active_plan(project_id: str) -> Optional[Dict[str, Any]]:
    """Get the active study plan for a project."""
    try:
        result = supabase.table("study_plans").select("*").eq(
            "project_id", project_id
        ).eq("status", "active").order("generated_at", desc=True).limit(1).execute()

        if not result.data:
            return None

        plan = result.data[0]

        days_result = supabase.table("study_plan_days").select("*").eq(
            "plan_id", plan["id"]
        ).order("day_number").execute()

        plan["days"] = days_result.data if days_result.data else []
        return plan
    except Exception as e:
        logger.error(f"Error fetching study plan: {e}")
        return None


def get_today_plan_day(project_id: str) -> Optional[Dict[str, Any]]:
    """Get today's study plan day."""
    try:
        plan = get_active_plan(project_id)
        if not plan:
            return None

        today = date.today().isoformat()
        for day in plan.get("days", []):
            if day.get("date") == today:
                return day

        return None
    except Exception as e:
        logger.error(f"Error fetching today's plan: {e}")
        return None


def evaluate_progress(project_id: str) -> Dict[str, Any]:
    """Compare actual mastery vs expected progress per topic.

    Identifies topics where the student is ahead or behind schedule
    and calculates overall pace.

    Args:
        project_id: The project ID to evaluate.

    Returns:
        Dict with on_track, ahead_topics, behind_topics, overall_progress_pct.
    """
    try:
        # Get active plan
        plan = get_active_plan(project_id)
        if not plan:
            return {
                "on_track": True,
                "ahead_topics": [],
                "behind_topics": [],
                "overall_progress_pct": 0.0,
            }

        # Get all topics for the project with their mastery levels
        topics_result = supabase.table("topics").select("*").eq(
            "project_id", project_id
        ).execute()
        topics = topics_result.data if topics_result.data else []

        if not topics:
            return {
                "on_track": True,
                "ahead_topics": [],
                "behind_topics": [],
                "overall_progress_pct": 0.0,
            }

        # Determine expected progress based on plan timeline
        total_days = plan.get("total_days", 1)
        plan_days = plan.get("days", [])
        today = date.today().isoformat()

        # Count how many plan days have passed
        days_elapsed = 0
        for day in plan_days:
            if day.get("date", "") <= today:
                days_elapsed += 1

        expected_progress_pct = (days_elapsed / max(total_days, 1)) * 100

        # Build a set of topic IDs that should have been covered by now
        expected_topic_ids = set()
        for day in plan_days:
            if day.get("date", "") <= today:
                for tid in day.get("topic_ids", []):
                    expected_topic_ids.add(tid)

        ahead_topics = []
        behind_topics = []
        total_mastery = 0.0

        for topic in topics:
            topic_id = topic["id"]
            mastery = topic.get("mastery_level", 0.0)
            total_mastery += mastery

            if topic_id in expected_topic_ids:
                # This topic should have been studied by now
                if mastery < 0.4:
                    behind_topics.append({
                        "topic_id": topic_id,
                        "name": topic.get("name", ""),
                        "mastery": mastery,
                        "expected_mastery": 0.5,
                    })
            else:
                # Topic not yet scheduled but student already has mastery
                if mastery >= 0.5:
                    ahead_topics.append({
                        "topic_id": topic_id,
                        "name": topic.get("name", ""),
                        "mastery": mastery,
                    })

        overall_progress_pct = (total_mastery / len(topics)) * 100 if topics else 0.0
        on_track = len(behind_topics) <= len(topics) * 0.2  # Behind on fewer than 20% of topics

        return {
            "on_track": on_track,
            "ahead_topics": ahead_topics,
            "behind_topics": behind_topics,
            "overall_progress_pct": round(overall_progress_pct, 1),
        }
    except Exception as e:
        logger.error(f"Error evaluating progress: {e}")
        return {
            "on_track": True,
            "ahead_topics": [],
            "behind_topics": [],
            "overall_progress_pct": 0.0,
        }


def adapt_plan(project_id: str, progress_report: Dict[str, Any]) -> Dict[str, Any]:
    """Adapt the study plan based on progress evaluation.

    If ahead: reallocate time from strong topics to weak ones.
    If behind: prioritize high-impact topics and compress less critical ones.
    Regenerates remaining plan days.

    Args:
        project_id: The project ID.
        progress_report: Output from evaluate_progress().

    Returns:
        Dict with adapted plan details.
    """
    try:
        plan = get_active_plan(project_id)
        if not plan:
            return {"adapted": False, "reason": "No active plan found"}

        today = date.today()
        plan_id = plan["id"]
        plan_days = plan.get("days", [])
        daily_target_minutes = plan.get("daily_target_minutes", 60)

        # Get remaining days (future days only)
        remaining_days = [
            d for d in plan_days if d.get("date", "") > today.isoformat()
        ]

        if not remaining_days:
            return {"adapted": False, "reason": "No remaining days in plan"}

        behind_topics = progress_report.get("behind_topics", [])
        ahead_topics = progress_report.get("ahead_topics", [])

        # Get all topic IDs for the project
        topics_result = supabase.table("topics").select("id, name, mastery_level").eq(
            "project_id", project_id
        ).execute()
        all_topics = topics_result.data if topics_result.data else []

        behind_ids = {t["topic_id"] for t in behind_topics}
        ahead_ids = {t["topic_id"] for t in ahead_topics}

        # Redistribute remaining days
        # Prioritize behind topics by giving them more slots
        behind_weight = 3
        normal_weight = 1

        weighted_topics = []
        for topic in all_topics:
            tid = topic["id"]
            if tid in behind_ids:
                weighted_topics.extend([tid] * behind_weight)
            elif tid not in ahead_ids:
                weighted_topics.extend([tid] * normal_weight)
            # Ahead topics get no additional slots (already mastered)

        if not weighted_topics:
            weighted_topics = [t["id"] for t in all_topics]

        # Assign topics to remaining days using round-robin on weighted list
        topics_per_day = max(1, len(set(weighted_topics)) // max(1, len(remaining_days)))
        idx = 0

        for day in remaining_days:
            day_topic_ids = []
            for _ in range(topics_per_day):
                if idx < len(weighted_topics):
                    tid = weighted_topics[idx]
                    if tid not in day_topic_ids:
                        day_topic_ids.append(tid)
                    idx += 1

            # Determine session type
            if progress_report.get("on_track", True):
                session_type = "new_material"
            else:
                session_type = "review" if any(t in behind_ids for t in day_topic_ids) else "new_material"

            # Update the plan day in the database
            supabase.table("study_plan_days").update({
                "topic_ids": day_topic_ids,
                "session_type": session_type,
                "estimated_minutes": daily_target_minutes,
            }).eq("id", day["id"]).execute()

        return {
            "adapted": True,
            "remaining_days_updated": len(remaining_days),
            "behind_topics_prioritized": len(behind_topics),
            "ahead_topics_reduced": len(ahead_topics),
        }
    except Exception as e:
        logger.error(f"Error adapting plan: {e}")
        return {"adapted": False, "reason": str(e)}


def detect_gaps(project_id: str) -> List[Dict[str, Any]]:
    """Use Claude Opus to analyze topic coverage and identify gaps.

    Compares existing topics against source material to find
    undertaught or missing topics.

    Args:
        project_id: The project ID.

    Returns:
        List of gap dicts: [{topic_name, severity, recommendation}, ...].
    """
    try:
        # Get existing topics
        topics_result = supabase.table("topics").select(
            "name, description, mastery_level"
        ).eq("project_id", project_id).execute()
        topics = topics_result.data if topics_result.data else []

        if not topics:
            return []

        # Get source material text for the project
        materials_result = supabase.table("materials").select(
            "extracted_text"
        ).eq("project_id", project_id).execute()
        materials = materials_result.data if materials_result.data else []

        source_text = "\n\n".join(
            m.get("extracted_text", "") for m in materials if m.get("extracted_text")
        )

        if not source_text:
            return []

        # Call Claude Opus for gap detection
        system_prompt, user_message = get_gap_detection_prompt(topics, source_text)
        ai_response = call_opus(system_prompt, user_message, max_tokens=4096)
        result = parse_json_response(ai_response)

        if result and "gaps" in result:
            return result["gaps"]

        return []
    except Exception as e:
        logger.error(f"Error detecting gaps: {e}")
        return []
