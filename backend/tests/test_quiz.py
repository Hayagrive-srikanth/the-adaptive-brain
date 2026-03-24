"""Tests for quiz endpoints and quiz_service."""

import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import (
    _make_supabase_mock,
    _make_query_mock,
    TEST_USER_ID,
    TEST_TOPIC_ID,
    TEST_SESSION_ID,
    TEST_QUESTION_ID,
    TEST_QUESTION_DATA,
    TEST_USER_DATA,
)


@pytest.fixture
def sb():
    return _make_supabase_mock()


@pytest.fixture
def quiz_client(sb):
    with patch("app.api.auth.supabase", sb), \
         patch("app.api.quiz.supabase", sb), \
         patch("app.api.quiz.create_client", return_value=sb), \
         patch("app.api.quiz.generate_questions") as mock_gen, \
         patch("app.api.quiz.evaluate_answer") as mock_eval, \
         patch("app.api.quiz.update_mastery") as mock_mastery, \
         patch("app.api.quiz.get_questions") as mock_get_q, \
         patch("app.api.quiz.rephrase_question") as mock_rephrase, \
         patch("app.api.quiz.get_question_hint") as mock_hint:
        mock_gen.return_value = [TEST_QUESTION_DATA]
        mock_eval.return_value = {
            "correct": True,
            "explanation": "Correct! Covalent bonds involve sharing electrons.",
            "correct_answer": None,
            "rephrasing_needed": False,
        }
        mock_mastery.return_value = 72.5
        mock_get_q.return_value = [TEST_QUESTION_DATA]
        mock_rephrase.return_value = {
            "rephrased_explanation": "Think of it like sharing toys.",
            "new_question": {
                "id": "new-q-uuid",
                "question_text": "Rephrased question",
                "question_type": "multiple_choice",
                "options": {"A": "X", "B": "Y"},
            },
            "level": 1,
        }
        mock_hint.return_value = "Think about electron sharing."
        from app.main import app
        from fastapi.testclient import TestClient
        yield TestClient(app)


HEADERS = {"Authorization": "Bearer valid-token"}


# ---------------------------------------------------------------------------
# POST /api/topics/{id}/questions/generate
# ---------------------------------------------------------------------------

class TestGenerateQuestions:
    def test_generate_questions_success(self, quiz_client, sb):
        """Generating questions returns array without correct_answer."""
        sb.table.return_value = _make_query_mock(data=TEST_USER_DATA)

        response = quiz_client.post(
            f"/api/topics/{TEST_TOPIC_ID}/questions/generate",
            json={"count": 5, "difficulty": "medium"},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "questions" in data
        # correct_answer should be stripped
        for q in data["questions"]:
            assert "correct_answer" not in q

    def test_generate_questions_custom_count(self, quiz_client, sb):
        """Generating with custom count works."""
        sb.table.return_value = _make_query_mock(data=TEST_USER_DATA)

        response = quiz_client.post(
            f"/api/topics/{TEST_TOPIC_ID}/questions/generate",
            json={"count": 3, "difficulty": "hard"},
            headers=HEADERS,
        )

        assert response.status_code == 200


# ---------------------------------------------------------------------------
# POST /api/quiz/attempt
# ---------------------------------------------------------------------------

class TestSubmitAttempt:
    def test_submit_correct_answer(self, quiz_client, sb):
        """Submitting a correct answer returns correct=True with explanation."""

        def table_side_effect(name):
            if name == "quiz_attempts":
                return _make_query_mock(data=[{
                    "id": "attempt-uuid",
                    "question_id": TEST_QUESTION_ID,
                }])
            elif name == "quiz_questions":
                return _make_query_mock(data={"topic_id": TEST_TOPIC_ID})
            return _make_query_mock(data=[])

        sb.table.side_effect = table_side_effect

        response = quiz_client.post("/api/quiz/attempt", json={
            "question_id": TEST_QUESTION_ID,
            "session_id": TEST_SESSION_ID,
            "user_answer": "B",
            "time_taken_seconds": 15,
            "hints_used": 0,
        }, headers=HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert data["correct"] is True
        assert "explanation" in data

    def test_submit_attempt_missing_fields(self, quiz_client):
        """Missing required fields returns 422."""
        response = quiz_client.post("/api/quiz/attempt", json={
            "question_id": TEST_QUESTION_ID,
        }, headers=HEADERS)

        assert response.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/quiz/rephrase
# ---------------------------------------------------------------------------

class TestRephraseQuestion:
    def test_rephrase_success(self, quiz_client, sb):
        """Rephrasing returns explanation and new question without correct_answer."""
        sb.table.return_value = _make_query_mock(data=TEST_USER_DATA)

        response = quiz_client.post("/api/quiz/rephrase", json={
            "question_id": TEST_QUESTION_ID,
            "attempt_count": 1,
        }, headers=HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert "rephrased_explanation" in data
        assert "new_question" in data
        # correct_answer should be stripped from new question
        if data["new_question"]:
            assert "correct_answer" not in data["new_question"]

    def test_rephrase_level_2(self, quiz_client, sb):
        """Rephrase with attempt_count=2 triggers level 2."""
        sb.table.return_value = _make_query_mock(data=TEST_USER_DATA)

        response = quiz_client.post("/api/quiz/rephrase", json={
            "question_id": TEST_QUESTION_ID,
            "attempt_count": 2,
        }, headers=HEADERS)

        assert response.status_code == 200


# ---------------------------------------------------------------------------
# POST /api/quiz/hint
# ---------------------------------------------------------------------------

class TestGetHint:
    def test_get_hint_success(self, quiz_client, sb):
        """Getting a hint returns hint text and index."""
        response = quiz_client.post("/api/quiz/hint", json={
            "question_id": TEST_QUESTION_ID,
            "hint_index": 0,
        }, headers=HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert "hint_text" in data
        assert data["hint_index"] == 0

    def test_get_hint_not_available(self, quiz_client, sb):
        """Hint at invalid index returns 404."""
        with patch("app.api.quiz.get_question_hint", return_value=None):
            response = quiz_client.post("/api/quiz/hint", json={
                "question_id": TEST_QUESTION_ID,
                "hint_index": 99,
            }, headers=HEADERS)

            assert response.status_code == 404
