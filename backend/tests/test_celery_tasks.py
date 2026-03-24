"""Tests for Celery tasks (process_material, generate_study_plan)."""

import pytest
from unittest.mock import patch, MagicMock, mock_open
from tests.conftest import (
    _make_supabase_mock,
    _make_query_mock,
    TEST_MATERIAL_ID,
    TEST_MATERIAL_DATA,
    TEST_PROJECT_ID,
    TEST_PROJECT_DATA,
    TEST_USER_ID,
    TEST_TOPIC_DATA,
    TEST_PLAN_ID,
)


# ---------------------------------------------------------------------------
# process_material task
# ---------------------------------------------------------------------------

class TestProcessMaterialTask:
    @patch("app.tasks.process_material.generate_embedding")
    @patch("app.tasks.process_material.get_page_count")
    @patch("app.tasks.process_material.process_document")
    @patch("app.tasks.process_material.supabase")
    def test_process_material_success(
        self, mock_sb, mock_ocr, mock_page_count, mock_embedding
    ):
        """process_material downloads file, runs OCR, updates record."""
        # Setup mocks
        mock_sb.table.return_value = _make_query_mock(data=TEST_MATERIAL_DATA)
        mock_sb.storage.from_.return_value.download.return_value = b"fake pdf bytes"

        mock_ocr.return_value = "Extracted text from document"
        mock_page_count.return_value = 5
        mock_embedding.return_value = [0.1, 0.2, 0.3]

        from app.tasks.process_material import process_material

        # Mock self.retry on the task object itself
        process_material.retry = MagicMock(side_effect=Exception("retry"))

        # Call the task's run method (bind=True means self is auto-injected)
        with patch("builtins.open", mock_open()):
            with patch("os.path.exists", return_value=True):
                with patch("os.unlink"):
                    result = process_material.run(TEST_MATERIAL_ID)

        assert result["status"] == "completed"
        assert result["material_id"] == TEST_MATERIAL_ID

    @patch("app.tasks.process_material.supabase")
    def test_process_material_not_found(self, mock_sb):
        """process_material with non-existent material returns None."""
        mock_sb.table.return_value = _make_query_mock(data=None)

        from app.tasks.process_material import process_material

        process_material.retry = MagicMock()
        result = process_material.run("nonexistent")

        assert result is None

    @patch("app.tasks.process_material.process_document")
    @patch("app.tasks.process_material.supabase")
    def test_process_material_retry_on_failure(self, mock_sb, mock_ocr):
        """process_material retries on OCR failure."""
        mock_sb.table.return_value = _make_query_mock(data=TEST_MATERIAL_DATA)
        mock_sb.storage.from_.return_value.download.return_value = b"pdf bytes"
        mock_ocr.side_effect = Exception("OCR crashed")

        from app.tasks.process_material import process_material

        process_material.retry = MagicMock(side_effect=Exception("retry called"))

        with patch("builtins.open", mock_open()):
            with patch("os.path.exists", return_value=True):
                with patch("os.unlink"):
                    with pytest.raises(Exception, match="retry called"):
                        process_material.run(TEST_MATERIAL_ID)

        process_material.retry.assert_called_once()


# ---------------------------------------------------------------------------
# generate_study_plan task
# ---------------------------------------------------------------------------

class TestGenerateStudyPlanTask:
    @patch("app.tasks.generate_plan.generate_plan")
    @patch("app.tasks.generate_plan.generate_embedding")
    @patch("app.tasks.generate_plan.parse_json_response")
    @patch("app.tasks.generate_plan.call_opus")
    @patch("app.tasks.generate_plan.supabase")
    def test_generate_study_plan_success(
        self, mock_sb, mock_opus, mock_parse, mock_embedding, mock_gen_plan
    ):
        """generate_study_plan extracts topics and generates plan."""
        # Project data
        project_data = {**TEST_PROJECT_DATA, "user_id": TEST_USER_ID}
        user_data = {"profile": {"learning_modality": "visual"}}
        materials_data = [
            {"id": "mat-1", "ocr_text": "Chemistry chapter on bonding", "file_type": "pdf"},
        ]

        call_count = [0]

        def table_side_effect(name):
            call_count[0] += 1
            if name == "projects":
                return _make_query_mock(data=project_data)
            elif name == "users":
                return _make_query_mock(data=user_data)
            elif name == "source_materials":
                return _make_query_mock(data=materials_data)
            elif name == "topics":
                return _make_query_mock(data=[{
                    "id": "new-topic-1",
                    "name": "Chemical Bonding",
                    "prerequisite_ids": [],
                }])
            return _make_query_mock(data=[])

        mock_sb.table.side_effect = table_side_effect

        mock_opus.return_value = "json topics"
        mock_parse.return_value = {
            "topics": [
                {
                    "name": "Chemical Bonding",
                    "description": "Types of bonds",
                    "difficulty": "intermediate",
                    "estimated_minutes": 45,
                    "prerequisite_names": [],
                },
            ],
        }
        mock_embedding.return_value = [0.1, 0.2]
        mock_gen_plan.return_value = {
            "plan_id": TEST_PLAN_ID,
            "total_days": 30,
            "days": [],
        }

        from app.tasks.generate_plan import generate_study_plan

        generate_study_plan.retry = MagicMock(side_effect=Exception("retry"))
        result = generate_study_plan.run(TEST_PROJECT_ID)

        assert result["status"] == "completed"
        assert result["project_id"] == TEST_PROJECT_ID
        assert result["topics_count"] >= 1

    @patch("app.tasks.generate_plan.supabase")
    def test_generate_study_plan_project_not_found(self, mock_sb):
        """generate_study_plan with non-existent project returns None."""
        mock_sb.table.return_value = _make_query_mock(data=None)

        from app.tasks.generate_plan import generate_study_plan

        generate_study_plan.retry = MagicMock()
        result = generate_study_plan.run("nonexistent")

        assert result is None

    @patch("app.tasks.generate_plan.supabase")
    def test_generate_study_plan_no_materials(self, mock_sb):
        """generate_study_plan with no completed materials returns None."""
        project_data = {**TEST_PROJECT_DATA, "user_id": TEST_USER_ID}
        user_data = {"profile": {}}

        call_count = [0]

        def table_side_effect(name):
            call_count[0] += 1
            if name == "projects":
                return _make_query_mock(data=project_data)
            elif name == "users":
                return _make_query_mock(data=user_data)
            elif name == "source_materials":
                return _make_query_mock(data=[])
            return _make_query_mock(data=[])

        mock_sb.table.side_effect = table_side_effect

        from app.tasks.generate_plan import generate_study_plan

        generate_study_plan.retry = MagicMock()
        result = generate_study_plan.run(TEST_PROJECT_ID)

        assert result is None

    @patch("app.tasks.generate_plan.call_opus")
    @patch("app.tasks.generate_plan.supabase")
    def test_generate_study_plan_retry_on_failure(self, mock_sb, mock_opus):
        """generate_study_plan retries on AI failure."""
        project_data = {**TEST_PROJECT_DATA, "user_id": TEST_USER_ID}
        user_data = {"profile": {}}
        materials_data = [{"id": "m1", "ocr_text": "some text", "file_type": "pdf"}]

        call_count = [0]

        def table_side_effect(name):
            call_count[0] += 1
            if name == "projects":
                return _make_query_mock(data=project_data)
            elif name == "users":
                return _make_query_mock(data=user_data)
            elif name == "source_materials":
                return _make_query_mock(data=materials_data)
            return _make_query_mock(data=[])

        mock_sb.table.side_effect = table_side_effect
        mock_opus.side_effect = Exception("API down")

        from app.tasks.generate_plan import generate_study_plan

        generate_study_plan.retry = MagicMock(side_effect=Exception("retry triggered"))

        with pytest.raises(Exception, match="retry triggered"):
            generate_study_plan.run(TEST_PROJECT_ID)

        generate_study_plan.retry.assert_called_once()
