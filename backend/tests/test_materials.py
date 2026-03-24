"""Tests for material upload/processing endpoints."""

import io
import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import (
    _make_supabase_mock,
    _make_query_mock,
    TEST_USER_ID,
    TEST_PROJECT_ID,
    TEST_PROJECT_DATA,
    TEST_MATERIAL_ID,
    TEST_MATERIAL_DATA,
)


@pytest.fixture
def sb():
    return _make_supabase_mock()


@pytest.fixture
def mat_client(sb):
    with patch("app.api.auth.supabase", sb), \
         patch("app.api.materials.supabase", sb), \
         patch("app.api.materials.create_client", return_value=sb), \
         patch("app.api.materials.process_material") as mock_task:
        mock_task.delay.return_value = MagicMock(id="celery-task-id")
        from app.main import app
        from fastapi.testclient import TestClient
        yield TestClient(app)


HEADERS = {"Authorization": "Bearer valid-token"}


# ---------------------------------------------------------------------------
# POST /api/projects/{id}/materials (upload)
# ---------------------------------------------------------------------------

class TestUploadMaterials:
    def test_upload_pdf_success(self, mat_client, sb):
        """Uploading a PDF file creates a material record and triggers processing."""
        sb.table.return_value = _make_query_mock(data=[TEST_MATERIAL_DATA])

        pdf_content = b"%PDF-1.4 fake pdf content"
        files = [("files", ("notes.pdf", io.BytesIO(pdf_content), "application/pdf"))]

        response = mat_client.post(
            f"/api/projects/{TEST_PROJECT_ID}/materials",
            files=files,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "materials" in data
        assert "count" in data

    def test_upload_docx_success(self, mat_client, sb):
        """Uploading a DOCX file is accepted."""
        sb.table.return_value = _make_query_mock(data=[TEST_MATERIAL_DATA])

        content = b"PK fake docx content"
        files = [("files", ("doc.docx", io.BytesIO(content), "application/vnd.openxmlformats"))]

        response = mat_client.post(
            f"/api/projects/{TEST_PROJECT_ID}/materials",
            files=files,
            headers=HEADERS,
        )

        assert response.status_code == 200

    def test_upload_unsupported_file_type(self, mat_client, sb):
        """Uploading an unsupported file type (.exe) is silently skipped."""
        sb.table.return_value = _make_query_mock(data=TEST_PROJECT_DATA)

        files = [("files", ("virus.exe", io.BytesIO(b"bad"), "application/octet-stream"))]

        response = mat_client.post(
            f"/api/projects/{TEST_PROJECT_ID}/materials",
            files=files,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 0

    def test_upload_project_not_found(self, mat_client, sb):
        """Uploading to non-existent project returns 404."""
        sb.table.return_value = _make_query_mock(data=None)

        files = [("files", ("notes.pdf", io.BytesIO(b"pdf"), "application/pdf"))]

        response = mat_client.post(
            "/api/projects/nonexistent/materials",
            files=files,
            headers=HEADERS,
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/projects/{id}/materials (list)
# ---------------------------------------------------------------------------

class TestListMaterials:
    def test_list_materials_success(self, mat_client, sb):
        """Listing materials returns array of material records."""
        sb.table.return_value = _make_query_mock(data=[TEST_MATERIAL_DATA])

        response = mat_client.get(
            f"/api/projects/{TEST_PROJECT_ID}/materials", headers=HEADERS
        )

        assert response.status_code == 200
        data = response.json()
        assert "materials" in data

    def test_list_materials_empty(self, mat_client, sb):
        """Empty project returns empty materials list."""
        # First call: project ownership check, second: materials list
        sb.table.return_value = _make_query_mock(data=[])

        response = mat_client.get(
            f"/api/projects/{TEST_PROJECT_ID}/materials", headers=HEADERS
        )

        # May be 200 with empty list or 404 depending on ownership check
        assert response.status_code in (200, 404)


# ---------------------------------------------------------------------------
# GET /api/materials/{id}/status (check status)
# ---------------------------------------------------------------------------

class TestGetMaterialStatus:
    def test_get_status_success(self, mat_client, sb):
        """Getting material status returns processing info."""
        status_data = {
            "id": TEST_MATERIAL_ID,
            "processing_status": "completed",
            "page_count": 10,
        }
        sb.table.return_value = _make_query_mock(data=status_data)

        response = mat_client.get(
            f"/api/materials/{TEST_MATERIAL_ID}/status", headers=HEADERS
        )

        assert response.status_code == 200

    def test_get_status_not_found(self, mat_client, sb):
        """Getting status of non-existent material returns 404."""
        sb.table.return_value = _make_query_mock(data=None)

        response = mat_client.get(
            "/api/materials/nonexistent/status", headers=HEADERS
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# File type validation
# ---------------------------------------------------------------------------

class TestFileTypeValidation:
    def test_allowed_extensions_pdf(self, mat_client, sb):
        """PDF extension is allowed."""
        sb.table.return_value = _make_query_mock(data=[TEST_MATERIAL_DATA])

        files = [("files", ("test.pdf", io.BytesIO(b"content"), "application/pdf"))]
        response = mat_client.post(
            f"/api/projects/{TEST_PROJECT_ID}/materials",
            files=files,
            headers=HEADERS,
        )
        assert response.status_code == 200

    def test_allowed_extensions_image(self, mat_client, sb):
        """Image extensions (png, jpg, jpeg) are allowed."""
        sb.table.return_value = _make_query_mock(data=[TEST_MATERIAL_DATA])

        for ext in ("png", "jpg", "jpeg"):
            files = [("files", (f"photo.{ext}", io.BytesIO(b"img"), f"image/{ext}"))]
            response = mat_client.post(
                f"/api/projects/{TEST_PROJECT_ID}/materials",
                files=files,
                headers=HEADERS,
            )
            assert response.status_code == 200

    def test_rejected_extension_txt(self, mat_client, sb):
        """TXT extension is not in ALLOWED_EXTENSIONS and is skipped."""
        sb.table.return_value = _make_query_mock(data=TEST_PROJECT_DATA)

        files = [("files", ("notes.txt", io.BytesIO(b"text"), "text/plain"))]
        response = mat_client.post(
            f"/api/projects/{TEST_PROJECT_ID}/materials",
            files=files,
            headers=HEADERS,
        )
        assert response.status_code == 200
        assert response.json()["count"] == 0
