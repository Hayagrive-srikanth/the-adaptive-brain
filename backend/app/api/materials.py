import uuid
from fastapi import APIRouter, HTTPException, Header, UploadFile, File
from typing import List
from supabase import create_client
from app.config import settings
from app.api.auth import get_current_user_id
from app.tasks.process_material import process_material

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "docx", "pptx", "mp3", "wav"}


def _get_file_type(filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ("png", "jpg", "jpeg"):
        return "image"
    return ext


@router.post("/projects/{project_id}/materials")
async def upload_materials(
    project_id: str,
    files: List[UploadFile] = File(...),
    authorization: str = Header(...),
):
    """Upload study materials for a project."""
    try:
        user_id = await get_current_user_id(authorization)

        # Verify project ownership
        project = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        uploaded = []
        for file in files:
            ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
            if ext not in ALLOWED_EXTENSIONS:
                continue

            file_type = _get_file_type(file.filename or "unknown")
            file_id = str(uuid.uuid4())
            storage_path = f"{project_id}/{file_id}.{ext}"

            # Read file content
            content = await file.read()

            # Upload to Supabase Storage
            supabase.storage.from_("materials").upload(
                storage_path, content
            )

            # Create material record
            result = supabase.table("source_materials").insert({
                "project_id": project_id,
                "original_filename": file.filename,
                "file_type": file_type,
                "storage_path": storage_path,
                "processing_status": "pending",
            }).execute()

            if result.data:
                material = result.data[0]
                uploaded.append(material)

                # Trigger async processing
                process_material.delay(material["id"])

        return {"materials": uploaded, "count": len(uploaded)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/projects/{project_id}/materials")
async def list_materials(project_id: str, authorization: str = Header(...)):
    """List all materials for a project with processing status."""
    try:
        user_id = await get_current_user_id(authorization)

        # Verify project ownership
        project = supabase.table("projects").select("id").eq(
            "id", project_id
        ).eq("user_id", user_id).single().execute()

        if not project.data:
            raise HTTPException(status_code=404, detail="Project not found")

        result = supabase.table("source_materials").select(
            "id, original_filename, file_type, processing_status, page_count, created_at"
        ).eq("project_id", project_id).order("created_at").execute()

        return {"materials": result.data or []}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/materials/{material_id}/status")
async def get_material_status(material_id: str, authorization: str = Header(...)):
    """Check processing status of a material."""
    try:
        await get_current_user_id(authorization)

        result = supabase.table("source_materials").select(
            "id, processing_status, page_count"
        ).eq("id", material_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="Material not found")

        return result.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/materials/{material_id}")
async def delete_material(material_id: str, authorization: str = Header(...)):
    """Delete a material and its storage file."""
    try:
        await get_current_user_id(authorization)

        material = supabase.table("source_materials").select(
            "id, storage_path"
        ).eq("id", material_id).single().execute()

        if not material.data:
            raise HTTPException(status_code=404, detail="Material not found")

        # Delete from storage
        if material.data.get("storage_path"):
            try:
                supabase.storage.from_("materials").remove([material.data["storage_path"]])
            except Exception:
                pass

        # Delete record
        supabase.table("source_materials").delete().eq("id", material_id).execute()

        return {"message": "Material deleted"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
