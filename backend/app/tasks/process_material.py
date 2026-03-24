import os
import tempfile
import logging
from app.celery_app import celery_app
from app.config import settings
from app.services.ocr_engine import process_document, get_page_count
from app.services.embedding_engine import generate_embedding
from supabase import create_client

logger = logging.getLogger(__name__)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


@celery_app.task(bind=True, max_retries=3)
def process_material(self, material_id: str):
    """Process an uploaded material: download, OCR, embed."""
    tmp_path = None
    try:
        # 1. Fetch material record
        result = supabase.table("source_materials").select("*").eq(
            "id", material_id
        ).single().execute()
        material = result.data

        if not material:
            logger.error(f"Material {material_id} not found")
            return

        # 2. Update status to processing
        supabase.table("source_materials").update({
            "processing_status": "processing",
        }).eq("id", material_id).execute()

        # 3. Download file from Supabase Storage
        storage_path = material["storage_path"]
        file_type = material["file_type"]
        ext = file_type if file_type not in ("image",) else "png"

        logger.info(f"[DEBUG] Material {material_id}: storage_path={storage_path}, file_type={file_type}")

        # Use a fixed temp path instead of NamedTemporaryFile to avoid Windows locking
        tmp_dir = tempfile.gettempdir()
        tmp_path = os.path.join(tmp_dir, f"adaptive_brain_{material_id}.{ext}")

        file_data = supabase.storage.from_("materials").download(storage_path)
        logger.info(f"[DEBUG] Material {material_id}: downloaded {len(file_data)} bytes to {tmp_path}")
        with open(tmp_path, "wb") as f:
            f.write(file_data)

        # 4. Run OCR/text extraction
        logger.info(f"[DEBUG] Material {material_id}: starting text extraction for file_type={file_type}")
        ocr_text = process_document(tmp_path, file_type)
        logger.info(f"[DEBUG] Material {material_id}: extracted text length = {len(ocr_text)} chars")
        logger.info(f"[DEBUG] Material {material_id}: first 500 chars of extracted text:\n{ocr_text[:500]}")

        # 5. Get page count
        page_count = get_page_count(tmp_path, file_type)
        logger.info(f"[DEBUG] Material {material_id}: page_count={page_count}")

        # 6. Generate embedding
        embedding = None
        if ocr_text:
            embedding = generate_embedding(ocr_text[:5000])

        # 7. Update material record
        update_data = {
            "processing_status": "completed",
            "ocr_text": ocr_text,
            "page_count": page_count,
        }
        if embedding:
            update_data["embedding"] = embedding

        supabase.table("source_materials").update(update_data).eq(
            "id", material_id
        ).execute()

        logger.info(f"Material {material_id} processed successfully")
        return {"status": "completed", "material_id": material_id}

    except Exception as e:
        logger.error(f"Error processing material {material_id}: {e}")

        try:
            supabase.table("source_materials").update({
                "processing_status": "failed",
            }).eq("id", material_id).execute()
        except Exception:
            pass

        raise self.retry(exc=e, countdown=60)

    finally:
        # Clean up temp file
        if tmp_path:
            try:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            except (PermissionError, OSError):
                pass  # Windows may still lock the file
