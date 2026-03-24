import logging
from typing import Dict, Any, List
from supabase import create_client
from app.config import settings
from app.services.ai_engine import call_sonnet, parse_json_response
from app.prompts.profile_edit import get_profile_edit_prompt

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def create_profile_from_onboarding(answers: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Map onboarding answers to a user profile JSON."""
    profile = {
        "learning_modality": "mixed",
        "attention_span_minutes": 20,
        "engagement_style": "moderate",
        "language": {
            "first_language": "en",
            "english_comfort": "native",
        },
        "neurodivergent": {
            "adhd": False,
            "dyslexia": False,
            "autism": False,
            "other": None,
        },
        "study_time_preference": "varies",
        "motivation_type": "progress_stats",
        "custom_notes": "",
    }

    answer_map = {a["question_id"]: a["answer"] for a in answers}

    # Q1: Learning modality
    q1 = answer_map.get(1, "")
    modality_map = {
        "Reading text": "reading",
        "Listening to audio": "audio",
        "Watching visuals & diagrams": "visual",
        "A mix of everything": "mixed",
    }
    profile["learning_modality"] = modality_map.get(q1, "mixed")

    # Q2: Attention span
    q2 = answer_map.get(2, "")
    span_map = {
        "Under 10 minutes": 8,
        "10 to 20 minutes": 15,
        "20 to 40 minutes": 30,
        "Over 40 minutes": 45,
    }
    profile["attention_span_minutes"] = span_map.get(q2, 20)

    # Q3: Engagement style
    q3 = answer_map.get(3, "")
    engagement_map = {
        "Love them — they keep me engaged": "gamified",
        "They're fine in small doses": "moderate",
        "I prefer to just review at my own pace": "self_paced",
    }
    profile["engagement_style"] = engagement_map.get(q3, "moderate")

    # Q4: Language
    q4 = answer_map.get(4, "")
    if q4 == "Yes":
        profile["language"] = {"first_language": "en", "english_comfort": "native"}
    elif "comfortable" in q4.lower():
        profile["language"] = {"first_language": "other", "english_comfort": "comfortable"}
    else:
        profile["language"] = {"first_language": "other", "english_comfort": "struggling"}

    # Q5: Neurodivergent
    q5 = answer_map.get(5, "")
    profile["neurodivergent"] = {
        "adhd": "ADHD" in q5 or "attention" in q5.lower(),
        "dyslexia": "Dyslexia" in q5 or "reading difficulties" in q5.lower(),
        "autism": "Autism" in q5,
        "other": None,
    }

    # Q6: Study time preference
    q6 = answer_map.get(6, "")
    time_map = {
        "Morning": "morning",
        "Afternoon": "afternoon",
        "Evening": "evening",
        "Late night": "night",
        "It varies": "varies",
    }
    profile["study_time_preference"] = time_map.get(q6, "varies")

    # Q7: Motivation type
    q7 = answer_map.get(7, "")
    motivation_map = {
        "Seeing my progress in stats": "progress_stats",
        "Daily streaks and goals": "streaks",
        "Competing with friends": "social",
        "Just passing the exam": "outcome_focused",
    }
    profile["motivation_type"] = motivation_map.get(q7, "progress_stats")

    return profile


def interpret_profile_edit(
    user_id: str,
    current_profile: Dict[str, Any],
    user_prompt: str,
) -> Dict[str, Any]:
    """Interpret a natural language profile edit request using Claude."""
    try:
        system_prompt, user_message = get_profile_edit_prompt(
            current_profile=current_profile,
            user_prompt=user_prompt,
        )

        response = call_sonnet(system_prompt, user_message, max_tokens=2048)
        result = parse_json_response(response)

        updated_profile = result.get("updated_profile", current_profile)
        fields_changed = result.get("fields_changed", {})
        interpretation = result.get("interpretation", "Profile updated based on your request.")

        # Update user profile in database
        supabase.table("users").update({
            "profile": updated_profile,
        }).eq("id", user_id).execute()

        # Log the edit
        supabase.table("profile_edit_log").insert({
            "user_id": user_id,
            "user_prompt": user_prompt,
            "fields_changed": fields_changed,
            "ai_interpretation": interpretation,
        }).execute()

        return {
            "updated_profile": updated_profile,
            "fields_changed": fields_changed,
            "interpretation": interpretation,
        }
    except Exception as e:
        logger.error(f"Error interpreting profile edit: {e}")
        raise
