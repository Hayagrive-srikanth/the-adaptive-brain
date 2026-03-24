"""Tests for topic endpoints (GET /api/projects/{id}/topics, GET /api/topics/{id}, POST generate)."""

import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import (
    _make_supabase_mock,
    _make_query_mock,
    TEST_USER_ID,
    TEST_PROJECT_ID,
    TEST_PROJECT_DATA,
    TEST_TOPIC_ID,
    TEST_TOPIC_DATA,
)


@pytest.fixture
def sb():
    return _make_supabase_mock()


@pytest.fixture
def topic_client(sb):
    with patch("app.api.auth.supabase", sb), \
         patch("app.api.topics.supabase", sb), \
         patch("app.api.topics.create_client", return_value=sb), \
         patch("app.api.topics.generate_study_plan") as mock_task, \
         patch("app.api.topics.build_graph", return_value={"nodes": [], "edges": []}):
        mock_task.delay.return_value = MagicMock(id="celery-task-id")
        from app.main import app
        from fastapi.testclient import TestClient
        yield TestClient(app)


HEADERS = {"Authorization": "Bearer valid-token"}


# ---------------------------------------------------------------------------
# GET /api/projects/{id}/topics
# ---------------------------------------------------------------------------

class TestListTopics:
    def test_list_topics_success(self, topic_client, sb):
        """Listing topics returns array with total_count."""
        sb.table.return_value = _make_query_mock(data=[TEST_TOPIC_DATA])

        response = topic_client.get(
            f"/api/projects/{TEST_PROJECT_ID}/topics", headers=HEADERS
        )

        assert response.status_code == 200
        data = response.json()
        assert "topics" in data
        assert "total_count" in data

    def test_list_topics_empty(self, topic_client, sb):
        """Project with no topics returns empty list."""
        # First call: ownership check returns project; second: topics query returns empty
        call_count = [0]
        original_table = sb.table

        def table_side_effect(name):
            call_count[0] += 1
            if call_count[0] == 1:
                return _make_query_mock(data=TEST_PROJECT_DATA)
            return _make_query_mock(data=[])

        sb.table.side_effect = table_side_effect

        response = topic_client.get(
            f"/api/projects/{TEST_PROJECT_ID}/topics", headers=HEADERS
        )

        assert response.status_code == 200
        data = response.json()
        assert data["topics"] == []
        assert data["total_count"] == 0

    def test_list_topics_project_not_found(self, topic_client, sb):
        """Listing topics for non-existent project returns 404."""
        sb.table.return_value = _make_query_mock(data=None)

        response = topic_client.get(
            "/api/projects/nonexistent/topics", headers=HEADERS
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/topics/{id}
# ---------------------------------------------------------------------------

class TestGetTopic:
    def test_get_topic_success(self, topic_client, sb):
        """Getting a topic returns topic data with content blocks."""
        content_blocks = [
            {"id": "cb-1", "topic_id": TEST_TOPIC_ID, "block_type": "text", "content": "Bond theory."},
        ]

        def table_side_effect(name):
            if name == "topics":
                return _make_query_mock(data={**TEST_TOPIC_DATA})
            elif name == "content_blocks":
                return _make_query_mock(data=content_blocks)
            return _make_query_mock(data=[])

        sb.table.side_effect = table_side_effect

        response = topic_client.get(
            f"/api/topics/{TEST_TOPIC_ID}", headers=HEADERS
        )

        assert response.status_code == 200

    def test_get_topic_not_found(self, topic_client, sb):
        """Getting a non-existent topic returns 404."""
        sb.table.return_value = _make_query_mock(data=None)

        response = topic_client.get(
            "/api/topics/nonexistent", headers=HEADERS
        )

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/projects/{id}/topics/generate
# ---------------------------------------------------------------------------

class TestGenerateTopics:
    def test_generate_topics_success(self, topic_client, sb):
        """Triggering topic generation returns task_id."""
        sb.table.return_value = _make_query_mock(data=TEST_PROJECT_DATA)

        response = topic_client.post(
            f"/api/projects/{TEST_PROJECT_ID}/topics/generate", headers=HEADERS
        )

        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        assert "message" in data

    def test_generate_topics_project_not_found(self, topic_client, sb):
        """Generating topics for non-existent project returns 404."""
        sb.table.return_value = _make_query_mock(data=None)

        response = topic_client.post(
            "/api/projects/nonexistent/topics/generate", headers=HEADERS
        )

        assert response.status_code == 404
