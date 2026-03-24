import json
from typing import Dict, Any, List, Tuple


SYSTEM_PROMPT = """You are an expert study planner for The Adaptive Brain, an AI-powered exam preparation companion. Your job is to create an optimal, personalized day-by-day study schedule.

You must consider:
1. Topic prerequisites — foundational topics come before advanced ones
2. The student's learning profile — attention span, study preferences, comfort level
3. Available time per day
4. Total days until the exam
5. Topic difficulty and estimated study time
6. Spaced repetition principles — revisit topics periodically
7. The final 2-3 days should be reserved for review and mock exams

Session types:
- "new_material": Learning new topics for the first time
- "review": Revisiting previously covered topics
- "mixed": Combination of new material and review
- "mock_exam": Full practice exam simulation

Return your plan as a JSON object:
{
  "days": [
    {
      "day_number": 1,
      "topic_ids": ["topic-uuid-1", "topic-uuid-2"],
      "session_type": "new_material",
      "estimated_minutes": 60,
      "focus_note": "Brief note about what to focus on today"
    }
  ],
  "strategy_notes": "Brief explanation of your planning strategy"
}

Rules:
- Never schedule more topics than fit within the daily time limit
- Account for the student's attention span when sizing sessions
- Front-load foundational topics
- If student is "beginner" comfort level, spend more time on basics
- If "review" comfort level, move quickly through foundations
- Include periodic review days (every 3-4 days of new material)
- Final 2-3 days MUST be review + mock exam
- Be realistic — leave buffer time for topics that might take longer
- Return ONLY the JSON object"""


def get_study_plan_prompt(
    topics: List[Dict[str, Any]],
    user_profile: Dict[str, Any],
    total_days: int,
    hours_per_day: float,
    comfort_level: str,
    exam_date: str,
) -> Tuple[str, str]:
    topics_summary = json.dumps([{
        "id": t.get("id", ""),
        "name": t.get("name", ""),
        "description": t.get("description", ""),
        "difficulty": t.get("difficulty", "intermediate"),
        "prerequisite_ids": t.get("prerequisite_ids", []),
        "estimated_minutes": t.get("estimated_minutes", 30),
    } for t in topics], indent=2)

    profile_summary = json.dumps(user_profile, indent=2)

    user_message = f"""Create an optimal study plan with these parameters:

STUDENT PROFILE:
{profile_summary}

TOPICS TO COVER:
{topics_summary}

SCHEDULE CONSTRAINTS:
- Total days until exam: {total_days}
- Hours available per day: {hours_per_day}
- Daily study minutes: {int(hours_per_day * 60)}
- Student comfort level: {comfort_level}
- Exam date: {exam_date}

Create a day-by-day schedule that respects prerequisites, matches the student's learning style, and reserves the final 2-3 days for review and mock exams."""

    return SYSTEM_PROMPT, user_message
