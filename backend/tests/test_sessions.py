"""Tests for session endpoints and session_service."""

import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import (
    _make_supabase_mock,
    _make_query_mock,
    TEST_USER_ID,
    TEST_PROJECT_ID,
    TEST_PROJECT_DATA,
    TEST_SESSION_ID,
    TEST_SESSION_DATA,
    TEST_TOPIC_ID,
    TEST_TOPIC_DATA,
    TEST_USER_DATA,
)


@pytest.fixture
def sb():
    return _make_supabase_mock()


@pytest.fixture
def session_client(sb):
    with patch("app.api.auth.supabase", sb), \
         patch("app.api.sessions.supabase", sb), \
         patch("app.api.sessions.create_client", return_value=sb), \
         patch("app.api.sessions.start_session") as mock_start, \
         patch("app.api.sessions.end_session") as mock_end, \
         patch("app.api.sessions.get_session_content") as mock_content:
        mock_start.return_value = TEST_SESSION_DATA
        mock_end.return_value = {
            "session_id": TEST_SESSION_ID,
            "topics_covered": [],
            "questions_answered": 5,
            "correct_answers": 3,
            "accuracy_percentage": 60.0,
            "duration_minutes": 30,
            "xp_earned": 35,
            "readiness_score_before": 40.0,
            "readiness_score_after": 45.0,
            "next_day_preview": None,
        }
        mock_content.return_value = {
            "topic_id": TEST_TOPIC_ID,
            "content_blocks": [],
            "quiz_questions": [],
        }
        from app.main import app
        from fastapi.testclient import TestClient
        yield TestClient(app)


HEADERS = {"Authorization": "Bearer valid-token"}


# ---------------------------------------------------------------------------
# POST /api/sessions/start
# ---------------------------------------------------------------------------

class TestStartSession:
    def test_start_session_success(self, session_client, sb):
        """Starting a session returns session data."""
        sb.table.return_value = _make_query_mock(data=TEST_PROJECT_DATA)

        response = session_client.post("/api/sessions/start", json={
            "project_id": TEST_PROJECT_ID,
        }, headers=HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == TEST_SESSION_ID

    def test_start_session_with_plan_day(self, session_client, sb):
        """Starting a session with a plan_day_id succeeds."""
        sb.table.return_value = _make_query_mock(data=TEST_PROJECT_DATA)

        response = session_client.post("/api/sessions/start", json={
            "project_id": TEST_PROJECT_ID,
            "plan_day_id": "plan-day-uuid",
        }, headers=HEADERS)

        assert response.status_code == 200

    def test_start_session_project_not_found(self, session_client, sb):
        """Starting session for non-existent project returns 404."""
        sb.table.return_value = _make_query_mock(data=None)

        response = session_client.post("/api/sessions/start", json={
            "project_id": "nonexistent",
        }, headers=HEADERS)

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/sessions/{id}/end
# ---------------------------------------------------------------------------

class TestEndSession:
    def test_end_session_success(self, session_client, sb):
        """Ending a session returns wrap-up summary."""
        response = session_client.post(
            f"/api/sessions/{TEST_SESSION_ID}/end",
            json={"topics_covered": [TEST_TOPIC_ID]},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "xp_earned" in data
        assert "accuracy_percentage" in data
        assert "duration_minutes" in data

    def test_end_session_no_topics(self, session_client, sb):
        """Ending a session with empty topics list still succeeds."""
        response = session_client.post(
            f"/api/sessions/{TEST_SESSION_ID}/end",
            json={"topics_covered": []},
            headers=HEADERS,
        )

        assert response.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/sessions/{id}
# ---------------------------------------------------------------------------

class TestGetSession:
    def test_get_session_success(self, session_client, sb):
        """Getting a session by ID returns session data."""
        sb.table.return_value = _make_query_mock(data=TEST_SESSION_DATA)

        response = session_client.get(
            f"/api/sessions/{TEST_SESSION_ID}", headers=HEADERS
        )

        assert response.status_code == 200

    def test_get_session_not_found(self, session_client, sb):
        """Getting non-existent session returns 404."""
        sb.table.return_value = _make_query_mock(data=None)

        response = session_client.get(
            "/api/sessions/nonexistent", headers=HEADERS
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/sessions/{id}/content/{topic_id}
# ---------------------------------------------------------------------------

class TestGetSessionContent:
    def test_get_content_success(self, session_client, sb):
        """Getting content for a topic in a session returns content blocks and questions."""
        sb.table.return_value = _make_query_mock(data=TEST_USER_DATA)

        response = session_client.get(
            f"/api/sessions/{TEST_SESSION_ID}/content/{TEST_TOPIC_ID}",
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "topic_id" in data
        assert "content_blocks" in data
        assert "quiz_questions" in data


# ---------------------------------------------------------------------------
# GET /api/projects/{id}/sessions
# ---------------------------------------------------------------------------

class TestListSessions:
    def test_list_sessions_success(self, session_client, sb):
        """Listing sessions for a project returns array."""
        sb.table.return_value = _make_query_mock(data=[TEST_SESSION_DATA])

        response = session_client.get(
            f"/api/projects/{TEST_PROJECT_ID}/sessions", headers=HEADERS
        )

        assert response.status_code == 200
        data = response.json()
        assert "sessions" in data

    def test_list_sessions_project_not_found(self, session_client, sb):
        """Listing sessions for non-existent project returns 404."""
        sb.table.return_value = _make_query_mock(data=None)

        response = session_client.get(
            "/api/projects/nonexistent/sessions", headers=HEADERS
        )

        assert response.status_code == 404
