"""Audio engine for The Adaptive Brain.

Handles text-to-speech generation via Deepgram TTS API and
speech-to-text transcription via Deepgram STT API.
Audio files are stored in a Supabase Storage bucket named "audio".
"""

import logging
import httpx
from typing import Dict, Any
from supabase import create_client
from app.config import settings

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

DEEPGRAM_TTS_URL = "https://api.deepgram.com/v1/speak"
DEEPGRAM_STT_URL = "https://api.deepgram.com/v1/listen"


def generate_audio(script: str, voice_settings: Dict[str, Any] = None) -> str:
    """Generate audio from a text script using the Deepgram TTS API.

    Args:
        script: The text to convert to speech.
        voice_settings: Optional dict with keys like 'model', 'voice', 'speed'.
            Defaults to aura-asteria-en model if not provided.

    Returns:
        The Supabase Storage path for the uploaded audio file,
        or an empty string if Deepgram is not configured.
    """
    api_key = getattr(settings, "DEEPGRAM_API_KEY", None)
    if not api_key:
        logger.warning(
            "Deepgram API key not configured (DEEPGRAM_API_KEY). "
            "Skipping audio generation."
        )
        return ""

    voice_settings = voice_settings or {}
    model = voice_settings.get("model", "aura-asteria-en")

    try:
        params = {"model": model}
        headers = {
            "Authorization": f"Token {api_key}",
            "Content-Type": "application/json",
        }
        body = {"text": script}

        with httpx.Client(timeout=120.0) as client:
            response = client.post(
                DEEPGRAM_TTS_URL,
                params=params,
                headers=headers,
                json=body,
            )
            response.raise_for_status()
            audio_bytes = response.content

        # Generate a unique filename
        import uuid
        filename = f"tts_{uuid.uuid4().hex}.mp3"
        storage_path = f"generated/{filename}"

        # Upload to Supabase Storage bucket "audio"
        supabase.storage.from_("audio").upload(
            path=storage_path,
            file=audio_bytes,
            file_options={"content-type": "audio/mpeg"},
        )

        logger.info(f"Audio generated and uploaded to audio/{storage_path}")
        return storage_path

    except httpx.HTTPStatusError as e:
        logger.error(f"Deepgram TTS API error: {e.response.status_code} - {e.response.text}")
        raise
    except Exception as e:
        logger.error(f"Error generating audio: {e}")
        raise


def transcribe_audio(audio_data: bytes) -> str:
    """Transcribe audio data to text using the Deepgram STT API.

    Args:
        audio_data: Raw audio bytes to transcribe.

    Returns:
        The transcribed text string.
    """
    api_key = getattr(settings, "DEEPGRAM_API_KEY", None)
    if not api_key:
        logger.warning(
            "Deepgram API key not configured (DEEPGRAM_API_KEY). "
            "Cannot transcribe audio."
        )
        return ""

    try:
        headers = {
            "Authorization": f"Token {api_key}",
            "Content-Type": "audio/mpeg",
        }
        params = {
            "model": "nova-2",
            "smart_format": "true",
            "punctuate": "true",
        }

        with httpx.Client(timeout=120.0) as client:
            response = client.post(
                DEEPGRAM_STT_URL,
                params=params,
                headers=headers,
                content=audio_data,
            )
            response.raise_for_status()
            result = response.json()

        # Extract transcript from Deepgram response
        channels = result.get("results", {}).get("channels", [])
        if channels:
            alternatives = channels[0].get("alternatives", [])
            if alternatives:
                return alternatives[0].get("transcript", "")

        return ""

    except httpx.HTTPStatusError as e:
        logger.error(f"Deepgram STT API error: {e.response.status_code} - {e.response.text}")
        raise
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        raise
