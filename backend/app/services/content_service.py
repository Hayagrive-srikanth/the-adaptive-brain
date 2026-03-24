import logging
from typing import Dict, Any, List, Optional
from supabase import create_client
from app.config import settings
from app.services.ai_engine import call_sonnet, parse_json_response
from app.prompts.content_transform import get_content_prompt

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


def generate_content_block(
    topic_id: str,
    user_profile: Dict[str, Any],
    content_type: str,
) -> Dict[str, Any]:
    """Generate a content block for a topic using Claude Sonnet."""
    try:
        # Fetch topic and its source material
        topic = supabase.table("topics").select("*").eq("id", topic_id).single().execute()
        topic_data = topic.data

        # Get source material text for this topic
        source_text = _get_topic_source_text(topic_data)

        system_prompt, user_message = get_content_prompt(
            content_type=content_type,
            topic_name=topic_data["name"],
            topic_description=topic_data.get("description", ""),
            source_text=source_text,
            user_profile=user_profile,
        )

        response = call_sonnet(system_prompt, user_message, max_tokens=4096)
        content_body = parse_json_response(response)

        if not content_body:
            content_body = {
                "title": topic_data["name"],
                "content": response,
                "type": content_type,
            }

        # Determine vocabulary level from profile
        language = user_profile.get("language", {})
        comfort = language.get("english_comfort", "native")

        format_metadata = {
            "vocabulary_level": comfort,
            "learning_modality": user_profile.get("learning_modality", "mixed"),
            "attention_span": user_profile.get("attention_span_minutes", 20),
        }

        # Estimate duration based on content type
        duration_map = {
            "summary": 10,
            "micro_lesson": 5,
            "flashcard_deck": 15,
            "concept_map": 8,
            "comparison_table": 7,
            "mnemonic_devices": 10,
            "audio_lesson": 12,
        }
        duration = duration_map.get(content_type, 10)

        # Store content block
        result = supabase.table("content_blocks").insert({
            "topic_id": topic_id,
            "content_type": content_type,
            "content_body": content_body,
            "format_metadata": format_metadata,
            "generated_by": "sonnet",
            "duration_estimate_minutes": duration,
        }).execute()

        return result.data[0] if result.data else {}
    except Exception as e:
        logger.error(f"Error generating content block: {e}")
        raise


def _get_topic_source_text(topic_data: Dict[str, Any]) -> str:
    """Get the source material text associated with a topic."""
    try:
        source_ids = topic_data.get("source_material_ids", [])
        if not source_ids:
            # Fall back to all materials in the project
            materials = supabase.table("source_materials").select("ocr_text").eq(
                "project_id", topic_data["project_id"]
            ).eq("processing_status", "completed").execute()
            texts = [m["ocr_text"] for m in (materials.data or []) if m.get("ocr_text")]
            return "\n\n".join(texts)

        materials = supabase.table("source_materials").select("ocr_text").in_(
            "id", source_ids
        ).execute()
        texts = [m["ocr_text"] for m in (materials.data or []) if m.get("ocr_text")]
        return "\n\n".join(texts)
    except Exception as e:
        logger.error(f"Error fetching source text: {e}")
        return ""


def get_content_blocks(topic_id: str) -> List[Dict[str, Any]]:
    """Get all content blocks for a topic."""
    try:
        result = supabase.table("content_blocks").select("*").eq(
            "topic_id", topic_id
        ).order("created_at").execute()
        return result.data if result.data else []
    except Exception as e:
        logger.error(f"Error fetching content blocks: {e}")
        return []


def recommend_formats(
    topic_id: str,
    user_profile: Dict[str, Any],
) -> List[str]:
    """Recommend content types based on the user's learning modality and profile.

    Mapping:
    - audio learner -> audio_lesson, micro_lesson
    - visual learner -> concept_map, flashcard_deck, mnemonic_devices
    - reading/writing learner -> summary, comparison_table
    - gamified / kinesthetic -> micro_lesson, flashcard_deck
    - mixed -> a balanced selection

    Also considers existing content blocks to avoid recommending types
    that have already been generated for this topic.

    Args:
        topic_id: UUID of the topic.
        user_profile: The student's profile dict.

    Returns:
        Ordered list of recommended content type strings.
    """
    modality = user_profile.get("learning_modality", "mixed").lower()

    modality_recommendations = {
        "audio": ["audio_lesson", "micro_lesson", "summary", "mnemonic_devices"],
        "visual": ["concept_map", "flashcard_deck", "mnemonic_devices", "micro_lesson", "summary"],
        "reading": ["summary", "comparison_table", "flashcard_deck", "concept_map"],
        "writing": ["summary", "comparison_table", "flashcard_deck", "concept_map"],
        "kinesthetic": ["micro_lesson", "flashcard_deck", "mnemonic_devices", "concept_map"],
        "gamified": ["micro_lesson", "flashcard_deck", "mnemonic_devices", "summary"],
        "mixed": ["summary", "micro_lesson", "flashcard_deck", "concept_map", "comparison_table", "mnemonic_devices", "audio_lesson"],
    }

    recommendations = modality_recommendations.get(
        modality, modality_recommendations["mixed"]
    )

    # Filter out content types already generated for this topic
    try:
        existing = supabase.table("content_blocks").select("content_type").eq(
            "topic_id", topic_id
        ).execute()
        existing_types = {b["content_type"] for b in (existing.data or [])}
        recommendations = [r for r in recommendations if r not in existing_types]
    except Exception as e:
        logger.warning(f"Could not filter existing content types: {e}")

    # If student has short attention span, prioritize bite-sized formats
    attention = user_profile.get("attention_span_minutes", 20)
    if attention < 10:
        priority_short = {"micro_lesson", "flashcard_deck", "mnemonic_devices"}
        recommendations.sort(key=lambda x: 0 if x in priority_short else 1)

    return recommendations
