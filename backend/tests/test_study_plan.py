"""Tests for study plan endpoints and study_plan_service."""

import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import (
    _make_supabase_mock,
    _make_query_mock,
    TEST_USER_ID,
    TEST_PROJECT_ID,
    TEST_PROJECT_DATA,
    TEST_PLAN_ID,
    TEST_PLAN_DATA,
    TEST_TOPIC_ID,
    TEST_TOPIC_DATA,
)


@pytest.fixture
def sb():
    return _make_supabase_mock()


@pytest.fixture
def plan_client(sb):
    with patch("app.api.auth.supabase", sb), \
         patch("app.api.study_plans.supabase", sb), \
         patch("app.api.study_plans.create_client", return_value=sb), \
         patch("app.api.study_plans.get_active_plan") as mock_active, \
         patch("app.api.study_plans.get_today_plan_day") as mock_today, \
         patch("app.api.study_plans.generate_study_plan") as mock_gen:
        mock_active.return_value = {
            **TEST_PLAN_DATA,
            "days": [
                {
                    "id": "day-1",
                    "plan_id": TEST_PLAN_ID,
                    "day_number": 1,
                    "date": "2026-03-24",
                    "topic_ids": [TEST_TOPIC_ID],
                    "session_type": "new_material",
                    "estimated_minutes": 120,
                    "completed": False,
                }
            ],
        }
        mock_today.return_value = {
            "id": "day-1",
            "plan_id": TEST_PLAN_ID,
            "day_number": 1,
            "date": "2026-03-24",
            "topic_ids": [TEST_TOPIC_ID],
            "session_type": "new_material",
            "estimated_minutes": 120,
            "completed": False,
        }
        mock_gen.delay.return_value = MagicMock(id="celery-task-id")
        from app.main import app
        from fastapi.testclient import TestClient
        yield TestClient(app)


HEADERS = {"Authorization": "Bearer valid-token"}


# ---------------------------------------------------------------------------
# GET /api/projects/{id}/plan
# ---------------------------------------------------------------------------

class TestGetPlan:
    def test_get_plan_success(self, plan_client, sb):
        """Getting the active plan returns plan with days."""
        sb.table.return_value = _make_query_mock(data=TEST_PROJECT_DATA)

        response = plan_client.get(
            f"/api/projects/{TEST_PROJECT_ID}/plan", headers=HEADERS
        )

        assert response.status_code == 200
        data = response.json()
        assert "days" in data
        assert data["total_days"] == 30

    def test_get_plan_not_found(self, plan_client, sb):
        """No active plan returns 404."""
        sb.table.return_value = _make_query_mock(data=TEST_PROJECT_DATA)

        with patch("app.api.study_plans.get_active_plan", return_value=None):
            response = plan_client.get(
                f"/api/projects/{TEST_PROJECT_ID}/plan", headers=HEADERS
            )

            assert response.status_code == 404

    def test_get_plan_project_not_found(self, plan_client, sb):
        """Getting plan for non-existent project returns 404."""
        sb.table.return_value = _make_query_mock(data=None)

        response = plan_client.get(
            "/api/projects/nonexistent/plan", headers=HEADERS
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# generate_plan() service function
# ---------------------------------------------------------------------------

class TestGeneratePlanService:
    @patch("app.services.study_plan_service.supabase")
    @patch("app.services.study_plan_service.call_opus")
    @patch("app.services.study_plan_service.parse_json_response")
    def test_generate_plan_success(self, mock_parse, mock_opus, mock_sb):
        """generate_plan() creates plan and stores days in database."""
        mock_opus.return_value = "json response"
        mock_parse.return_value = {
            "days": [
                {"day_number": 1, "topic_ids": [TEST_TOPIC_ID], "session_type": "new_material", "estimated_minutes": 120},
                {"day_number": 2, "topic_ids": [TEST_TOPIC_ID], "session_type": "review", "estimated_minutes": 60},
            ]
        }
        mock_sb.table.return_value = _make_query_mock(data=[{"id": TEST_PLAN_ID}])

        from app.services.study_plan_service import generate_plan
        result = generate_plan(
            project_id=TEST_PROJECT_ID,
            topics=[TEST_TOPIC_DATA],
            user_profile={},
            exam_date="2026-05-15",
            hours_per_day=2.0,
            comfort_level="intermediate",
        )

        assert result["plan_id"] == TEST_PLAN_ID
        assert len(result["days"]) == 2

    @patch("app.services.study_plan_service.supabase")
    @patch("app.services.study_plan_service.call_opus")
    @patch("app.services.study_plan_service.parse_json_response")
    def test_generate_plan_fallback(self, mock_parse, mock_opus, mock_sb):
        """generate_plan() uses fallback when AI returns invalid data."""
        mock_opus.return_value = "not json"
        mock_parse.return_value = {}  # No "days" key
        mock_sb.table.return_value = _make_query_mock(data=[{"id": TEST_PLAN_ID}])

        from app.services.study_plan_service import generate_plan
        result = generate_plan(
            project_id=TEST_PROJECT_ID,
            topics=[TEST_TOPIC_DATA],
            user_profile={},
            exam_date="2026-05-15",
            hours_per_day=2.0,
            comfort_level="intermediate",
        )

        assert result["plan_id"] == TEST_PLAN_ID
        assert len(result["days"]) > 0


# ---------------------------------------------------------------------------
# evaluate_progress()
# ---------------------------------------------------------------------------

class TestEvaluateProgress:
    @patch("app.services.study_plan_service.get_active_plan")
    @patch("app.services.study_plan_service.supabase")
    def test_evaluate_progress_no_plan(self, mock_sb, mock_active_plan):
        """evaluate_progress() with no active plan returns default on_track."""
        mock_active_plan.return_value = None

        from app.services.study_plan_service import evaluate_progress
        result = evaluate_progress(TEST_PROJECT_ID)

        assert result["on_track"] is True
        assert result["behind_topics"] == []
        assert result["ahead_topics"] == []

    @patch("app.services.study_plan_service.get_active_plan")
    @patch("app.services.study_plan_service.supabase")
    def test_evaluate_progress_with_behind_topics(self, mock_sb, mock_active_plan):
        """evaluate_progress() identifies topics behind schedule."""
        mock_active_plan.return_value = {
            "id": TEST_PLAN_ID,
            "total_days": 30,
            "days": [
                {"date": "2026-03-01", "topic_ids": [TEST_TOPIC_ID]},
            ],
        }
        # Topics with low mastery
        topic_with_low_mastery = {
            **TEST_TOPIC_DATA,
            "mastery_level": 0.1,
        }
        mock_sb.table.return_value = _make_query_mock(data=[topic_with_low_mastery])

        from app.services.study_plan_service import evaluate_progress
        result = evaluate_progress(TEST_PROJECT_ID)

        assert "behind_topics" in result
        assert "overall_progress_pct" in result


# ---------------------------------------------------------------------------
# adapt_plan()
# ---------------------------------------------------------------------------

class TestAdaptPlan:
    @patch("app.services.study_plan_service.get_active_plan")
    @patch("app.services.study_plan_service.supabase")
    def test_adapt_plan_no_active_plan(self, mock_sb, mock_active_plan):
        """adapt_plan() with no active plan returns adapted=False."""
        mock_active_plan.return_value = None

        from app.services.study_plan_service import adapt_plan
        result = adapt_plan(TEST_PROJECT_ID, {"behind_topics": [], "ahead_topics": []})

        assert result["adapted"] is False
        assert "reason" in result

    @patch("app.services.study_plan_service.get_active_plan")
    @patch("app.services.study_plan_service.supabase")
    def test_adapt_plan_no_remaining_days(self, mock_sb, mock_active_plan):
        """adapt_plan() with no future days returns adapted=False."""
        mock_active_plan.return_value = {
            "id": TEST_PLAN_ID,
            "daily_target_minutes": 120,
            "days": [
                {"id": "d1", "date": "2026-01-01", "topic_ids": [TEST_TOPIC_ID]},
            ],
        }

        from app.services.study_plan_service import adapt_plan
        result = adapt_plan(TEST_PROJECT_ID, {"behind_topics": [], "ahead_topics": []})

        assert result["adapted"] is False

    @patch("app.services.study_plan_service.get_active_plan")
    @patch("app.services.study_plan_service.supabase")
    def test_adapt_plan_success(self, mock_sb, mock_active_plan):
        """adapt_plan() with future days and behind topics returns adapted=True."""
        mock_active_plan.return_value = {
            "id": TEST_PLAN_ID,
            "daily_target_minutes": 120,
            "days": [
                {"id": "d1", "date": "2026-12-01", "topic_ids": [TEST_TOPIC_ID]},
                {"id": "d2", "date": "2026-12-02", "topic_ids": [TEST_TOPIC_ID]},
            ],
        }
        mock_sb.table.return_value = _make_query_mock(data=[TEST_TOPIC_DATA])

        from app.services.study_plan_service import adapt_plan
        result = adapt_plan(TEST_PROJECT_ID, {
            "on_track": False,
            "behind_topics": [{"topic_id": TEST_TOPIC_ID, "name": "Chemical Bonding", "mastery": 0.1}],
            "ahead_topics": [],
        })

        assert result["adapted"] is True
        assert result["remaining_days_updated"] == 2
