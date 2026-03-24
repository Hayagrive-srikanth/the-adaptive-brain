"""Audio API endpoints for The Adaptive Brain.

Provides endpoints for triggering audio generation, fetching audio details,
and submitting audio for transcription.
"""

from fastapi import APIRouter, HTTPException, Header, UploadFile, File
from supabase import create_client
from app.config import settings
from app.api.auth import get_current_user_id
from app.tasks.generate_audio import generate_audio_content
from app.services.audio_engine import transcribe_audio

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@router.post("/content/{content_block_id}/audio/generate")
async def trigger_audio_generation(
    content_block_id: str,
    authorization: str = Header(...),
):
    """Trigger async audio generation for a content block.

    Dispatches a Celery task to generate an audio script via Claude,
    convert it to speech via Deepgram, and store the result.
    """
    try:
        user_id = await get_current_user_id(authorization)

        # Get user profile
        user = supabase.table("users").select("profile").eq(
            "id", user_id
        ).single().execute()
        user_profile = user.data.get("profile", {}) if user.data else {}

        # Verify the content block exists
        block = supabase.table("content_blocks").select("id").eq(
            "id", content_block_id
        ).single().execute()

        if not block.data:
            raise HTTPException(status_code=404, detail="Content block not found")

        # Dispatch the Celery task
        task = generate_audio_content.delay(content_block_id, user_profile)

        return {
            "message": "Audio generation started",
            "task_id": task.id,
            "content_block_id": content_block_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/audio/{audio_id}")
async def get_audio_content(
    audio_id: str,
    authorization: str = Header(...),
):
    """Get audio content details by ID."""
    try:
        await get_current_user_id(authorization)

        result = supabase.table("audio_content").select("*").eq(
            "id", audio_id
        ).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Audio content not found")

        audio_data = result.data

        # Generate a signed URL for the audio file if it exists
        if audio_data.get("audio_storage_path"):
            try:
                signed = supabase.storage.from_("audio").create_signed_url(
                    audio_data["audio_storage_path"],
                    expires_in=3600,
                )
                audio_data["audio_url"] = signed.get("signedURL", "")
            except Exception:
                audio_data["audio_url"] = ""

        return {"audio_content": audio_data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/audio/transcribe")
async def transcribe_audio_file(
    file: UploadFile = File(...),
    authorization: str = Header(...),
):
    """Submit audio for transcription via Deepgram STT."""
    try:
        await get_current_user_id(authorization)

        audio_bytes = await file.read()

        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio file")

        transcript = transcribe_audio(audio_bytes)

        return {
            "transcript": transcript,
            "filename": file.filename,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
