"""Tests for wellbeing endpoints."""

import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import (
    _make_supabase_mock,
    _make_query_mock,
    TEST_USER_ID,
    TEST_SESSION_ID,
)


@pytest.fixture
def sb():
    return _make_supabase_mock()


@pytest.fixture
def well_client(sb):
    with patch("app.api.auth.supabase", sb), \
         patch("app.api.wellbeing.supabase", sb), \
         patch("app.api.wellbeing.create_client", return_value=sb), \
         patch("app.api.wellbeing.call_haiku") as mock_haiku, \
         patch("app.api.wellbeing.parse_json_response") as mock_parse:
        mock_haiku.return_value = '{"recommendation": "Take a short break"}'
        mock_parse.return_value = {
            "recommendation": "Take a short break before continuing.",
            "session_type": "light_session",
            "reduce_difficulty": True,
            "suggest_break": True,
        }
        from app.main import app
        from fastapi.testclient import TestClient
        yield TestClient(app)


HEADERS = {"Authorization": "Bearer valid-token"}


# ---------------------------------------------------------------------------
# POST /api/sessions/{id}/checkin
# ---------------------------------------------------------------------------

class TestWellbeingCheckin:
    def test_checkin_great_mood(self, well_client, sb):
        """Check-in with great mood returns recommendation."""
        session_data = {
            "id": TEST_SESSION_ID,
            "project_id": "proj-1",
            "session_type": "new_material",
        }
        sb.table.return_value = _make_query_mock(data=session_data)

        response = well_client.post(
            f"/api/sessions/{TEST_SESSION_ID}/checkin",
            json={"mood": "great", "energy_level": "high"},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "checkin" in data
        assert "adaptation" in data

    def test_checkin_stressed_mood(self, well_client, sb):
        """Check-in with stressed mood returns adaptation recommendation."""
        session_data = {
            "id": TEST_SESSION_ID,
            "project_id": "proj-1",
            "session_type": "new_material",
        }
        sb.table.return_value = _make_query_mock(data=session_data)

        response = well_client.post(
            f"/api/sessions/{TEST_SESSION_ID}/checkin",
            json={"mood": "stressed", "energy_level": "low"},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "adaptation" in data

    def test_checkin_burnt_out_mood(self, well_client, sb):
        """Check-in with burnt_out mood is accepted."""
        session_data = {
            "id": TEST_SESSION_ID,
            "project_id": "proj-1",
            "session_type": "review",
        }
        sb.table.return_value = _make_query_mock(data=session_data)

        response = well_client.post(
            f"/api/sessions/{TEST_SESSION_ID}/checkin",
            json={"mood": "burnt_out", "energy_level": "low"},
            headers=HEADERS,
        )

        assert response.status_code == 200

    def test_checkin_invalid_mood(self, well_client, sb):
        """Check-in with invalid mood returns 422."""
        response = well_client.post(
            f"/api/sessions/{TEST_SESSION_ID}/checkin",
            json={"mood": "invalid_mood", "energy_level": "high"},
            headers=HEADERS,
        )

        assert response.status_code == 422

    def test_checkin_invalid_energy(self, well_client, sb):
        """Check-in with invalid energy level returns 422."""
        response = well_client.post(
            f"/api/sessions/{TEST_SESSION_ID}/checkin",
            json={"mood": "great", "energy_level": "super_high"},
            headers=HEADERS,
        )

        assert response.status_code == 422

    def test_checkin_session_not_found(self, well_client, sb):
        """Check-in for non-existent session returns 404."""
        sb.table.return_value = _make_query_mock(data=None)

        response = well_client.post(
            "/api/sessions/nonexistent/checkin",
            json={"mood": "okay", "energy_level": "medium"},
            headers=HEADERS,
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/users/wellbeing/history
# ---------------------------------------------------------------------------

class TestWellbeingHistory:
    def test_get_history_success(self, well_client, sb):
        """Getting wellbeing history returns checkin records."""
        checkins = [
            {
                "mood": "great",
                "energy_level": "high",
                "recommendation": "Full session",
                "checked_in_at": "2026-03-24T10:00:00Z",
            },
            {
                "mood": "stressed",
                "energy_level": "low",
                "recommendation": "Light session",
                "checked_in_at": "2026-03-23T14:00:00Z",
            },
        ]
        sb.table.return_value = _make_query_mock(data=checkins)

        response = well_client.get(
            "/api/users/wellbeing/history", headers=HEADERS
        )

        assert response.status_code == 200
        data = response.json()
        assert "checkins" in data

    def test_get_history_empty(self, well_client, sb):
        """User with no checkins gets empty list."""
        sb.table.return_value = _make_query_mock(data=[])

        response = well_client.get(
            "/api/users/wellbeing/history", headers=HEADERS
        )

        assert response.status_code == 200
        assert response.json()["checkins"] == []

    def test_get_history_no_auth(self, well_client):
        """Getting history without auth returns 422."""
        response = well_client.get("/api/users/wellbeing/history")
        assert response.status_code == 422
