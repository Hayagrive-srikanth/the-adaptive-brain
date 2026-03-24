"""Celery task for generating audio content.

Generates an audio script via Claude Sonnet, converts it to speech via Deepgram TTS,
stores the audio file in Supabase Storage, and creates an audio_content record.
"""

import logging
from typing import Dict, Any
from supabase import create_client
from app.config import settings
from app.celery_app import celery_app
from app.services.ai_engine import call_sonnet, parse_json_response
from app.services.audio_engine import generate_audio
from app.prompts.audio_script import get_audio_script_prompt

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@celery_app.task(bind=True, name="generate_audio_content", max_retries=2)
def generate_audio_content(self, content_block_id: str, user_profile: Dict[str, Any]):
    """Generate audio content for an existing content block.

    Steps:
    1. Fetch the content block and its associated topic.
    2. Generate an audio script via Claude Sonnet.
    3. Send the script to Deepgram TTS to produce audio.
    4. Upload the audio to Supabase Storage.
    5. Create an audio_content record linking to the content block.

    Args:
        content_block_id: UUID of the content block to generate audio for.
        user_profile: The student's profile dict for adaptation.
    """
    try:
        # Fetch the content block
        block_result = supabase.table("content_blocks").select(
            "*, topics(name, description, project_id)"
        ).eq("id", content_block_id).single().execute()
        block = block_result.data

        if not block:
            logger.error(f"Content block {content_block_id} not found")
            return

        topic_data = block.get("topics", {})
        topic_name = topic_data.get("name", "Unknown Topic")

        # Build source content from the content block body
        content_body = block.get("content_body", {})
        if isinstance(content_body, dict):
            # Extract text from structured content
            parts = []
            if content_body.get("title"):
                parts.append(content_body["title"])
            for section in content_body.get("sections", []):
                parts.append(section.get("heading", ""))
                parts.append(section.get("content", ""))
            for bl in content_body.get("blocks", []):
                parts.append(bl.get("content", ""))
            topic_content = "\n\n".join(p for p in parts if p)
        else:
            topic_content = str(content_body)

        # Generate the audio script via Claude Sonnet
        system_prompt, user_message = get_audio_script_prompt(
            topic_name=topic_name,
            topic_content=topic_content,
            user_profile=user_profile,
        )

        response = call_sonnet(system_prompt, user_message, max_tokens=4096)
        script_data = parse_json_response(response)

        if not script_data:
            logger.error("Failed to parse audio script response")
            return

        script_text = script_data.get("script", "")
        if not script_text:
            logger.error("Audio script generation returned empty script")
            return

        # Strip [PAUSE] markers for TTS (replace with short silence notation)
        tts_script = script_text.replace("[PAUSE]", "... ")

        # Generate audio via Deepgram TTS
        voice_settings = user_profile.get("audio_preferences", {})
        storage_path = generate_audio(tts_script, voice_settings)

        if not storage_path:
            logger.warning("Audio generation skipped (Deepgram not configured)")
            # Still save the script data without audio
            storage_path = ""

        # Create audio_content record
        audio_record = supabase.table("audio_content").insert({
            "content_block_id": content_block_id,
            "script": script_text,
            "script_segments": script_data.get("segments", []),
            "audio_storage_path": storage_path,
            "duration_estimate_minutes": script_data.get("estimated_duration_minutes", 10),
            "voice_settings": voice_settings,
            "status": "completed" if storage_path else "script_only",
        }).execute()

        if audio_record.data:
            logger.info(
                f"Audio content created for block {content_block_id}: "
                f"{audio_record.data[0].get('id', 'unknown')}"
            )

        return audio_record.data[0] if audio_record.data else None

    except Exception as exc:
        logger.error(f"Error generating audio content: {exc}")
        raise self.retry(exc=exc, countdown=30)
