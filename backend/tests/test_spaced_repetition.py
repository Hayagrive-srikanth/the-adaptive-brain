"""Tests for SM-2 spaced repetition engine and review endpoints."""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
from tests.conftest import (
    _make_supabase_mock,
    _make_query_mock,
    TEST_USER_ID,
    TEST_QUESTION_ID,
    TEST_CARD_ID,
    TEST_CARD_DATA,
)


# ---------------------------------------------------------------------------
# calculate_sm2() — core algorithm
# ---------------------------------------------------------------------------

class TestCalculateSm2:
    def test_quality_gte_3_first_repetition(self):
        """Quality >= 3, repetition 0 -> interval = 1, repetition = 1."""
        from app.services.sm2_engine import calculate_sm2
        result = calculate_sm2(quality=4, easiness_factor=2.5, interval=1, repetition=0)

        assert result["interval"] == 1
        assert result["repetition"] == 1
        assert result["easiness_factor"] >= 1.3

    def test_quality_gte_3_second_repetition(self):
        """Quality >= 3, repetition 1 -> interval = 6, repetition = 2."""
        from app.services.sm2_engine import calculate_sm2
        result = calculate_sm2(quality=4, easiness_factor=2.5, interval=1, repetition=1)

        assert result["interval"] == 6
        assert result["repetition"] == 2

    def test_quality_gte_3_subsequent_repetition(self):
        """Quality >= 3, repetition >= 2 -> interval = round(old_interval * EF)."""
        from app.services.sm2_engine import calculate_sm2
        result = calculate_sm2(quality=4, easiness_factor=2.5, interval=6, repetition=2)

        expected_interval = round(6 * result["easiness_factor"])
        assert result["interval"] == expected_interval
        assert result["repetition"] == 3

    def test_quality_lt_3_resets(self):
        """Quality < 3 -> interval = 1, repetition = 0 (reset)."""
        from app.services.sm2_engine import calculate_sm2
        result = calculate_sm2(quality=2, easiness_factor=2.5, interval=10, repetition=5)

        assert result["interval"] == 1
        assert result["repetition"] == 0

    def test_quality_0_resets(self):
        """Quality 0 (complete blackout) resets interval and repetition."""
        from app.services.sm2_engine import calculate_sm2
        result = calculate_sm2(quality=0, easiness_factor=2.5, interval=30, repetition=10)

        assert result["interval"] == 1
        assert result["repetition"] == 0

    def test_interval_progression_1_6_ef(self):
        """Verify the standard SM-2 interval progression: 1 -> 6 -> 6*EF."""
        from app.services.sm2_engine import calculate_sm2

        # First review
        r1 = calculate_sm2(quality=4, easiness_factor=2.5, interval=1, repetition=0)
        assert r1["interval"] == 1

        # Second review
        r2 = calculate_sm2(quality=4, easiness_factor=r1["easiness_factor"], interval=r1["interval"], repetition=r1["repetition"])
        assert r2["interval"] == 6

        # Third review
        r3 = calculate_sm2(quality=4, easiness_factor=r2["easiness_factor"], interval=r2["interval"], repetition=r2["repetition"])
        expected = round(6 * r3["easiness_factor"])
        assert r3["interval"] == expected

    def test_ef_never_below_1_3(self):
        """EF should never go below 1.3 even with many low quality scores."""
        from app.services.sm2_engine import calculate_sm2

        ef = 2.5
        for _ in range(20):
            result = calculate_sm2(quality=0, easiness_factor=ef, interval=1, repetition=0)
            ef = result["easiness_factor"]

        assert ef >= 1.3

    def test_ef_decreases_with_low_quality(self):
        """Repeated low quality scores decrease EF toward 1.3."""
        from app.services.sm2_engine import calculate_sm2
        result = calculate_sm2(quality=3, easiness_factor=2.5, interval=1, repetition=0)
        # quality=3 gives EF adjustment of 0.1 - (5-3)*(0.08 + (5-3)*0.02) = 0.1 - 0.24 = -0.14
        assert result["easiness_factor"] < 2.5

    def test_ef_increases_with_high_quality(self):
        """High quality (5) increases EF."""
        from app.services.sm2_engine import calculate_sm2
        result = calculate_sm2(quality=5, easiness_factor=2.5, interval=1, repetition=0)
        assert result["easiness_factor"] > 2.5

    def test_exam_deadline_compression(self):
        """When next_review_date exceeds exam_date, interval is compressed."""
        from app.services.sm2_engine import calculate_sm2

        # Large interval that would exceed exam date
        exam_date = (datetime.utcnow().date() + timedelta(days=5)).isoformat()
        result = calculate_sm2(
            quality=5,
            easiness_factor=2.5,
            interval=30,  # Would result in large interval
            repetition=5,
            exam_date=exam_date,
        )

        # Interval should be compressed to fit before exam
        assert result["interval"] <= 5

    def test_exam_date_today_sets_interval_1(self):
        """When exam is today, interval should be 1."""
        from app.services.sm2_engine import calculate_sm2

        exam_date = datetime.utcnow().date().isoformat()
        result = calculate_sm2(
            quality=5,
            easiness_factor=2.5,
            interval=30,
            repetition=5,
            exam_date=exam_date,
        )

        assert result["interval"] == 1

    def test_no_exam_date_no_compression(self):
        """Without exam_date, no compression is applied."""
        from app.services.sm2_engine import calculate_sm2
        result = calculate_sm2(
            quality=5,
            easiness_factor=2.5,
            interval=6,
            repetition=2,
            exam_date=None,
        )

        # Should be the standard calculation
        assert result["interval"] == round(6 * result["easiness_factor"])

    def test_quality_clamped_to_valid_range(self):
        """Quality values outside 0-5 are clamped."""
        from app.services.sm2_engine import calculate_sm2

        result_high = calculate_sm2(quality=10, easiness_factor=2.5, interval=1, repetition=0)
        result_low = calculate_sm2(quality=-5, easiness_factor=2.5, interval=1, repetition=0)

        # quality=10 clamped to 5 -> success path
        assert result_high["repetition"] == 1
        # quality=-5 clamped to 0 -> failure path
        assert result_low["repetition"] == 0


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@pytest.fixture
def sb():
    return _make_supabase_mock()


@pytest.fixture
def sr_client(sb):
    with patch("app.api.auth.supabase", sb), \
         patch("app.api.spaced_repetition.supabase", sb), \
         patch("app.api.spaced_repetition.create_client", return_value=sb), \
         patch("app.api.spaced_repetition.get_due_cards") as mock_due, \
         patch("app.api.spaced_repetition.process_attempt") as mock_process, \
         patch("app.api.spaced_repetition.create_card") as mock_create:
        mock_due.return_value = [TEST_CARD_DATA]
        mock_process.return_value = {
            **TEST_CARD_DATA,
            "interval": 6,
            "repetition": 1,
            "next_review_date": "2026-03-27",
        }
        mock_create.return_value = TEST_CARD_DATA
        from app.main import app
        from fastapi.testclient import TestClient
        yield TestClient(app)


HEADERS = {"Authorization": "Bearer valid-token"}


# ---------------------------------------------------------------------------
# GET /api/reviews/due
# ---------------------------------------------------------------------------

class TestGetDueReviews:
    def test_get_due_reviews_success(self, sr_client, sb):
        """Getting due reviews returns cards and count."""
        response = sr_client.get("/api/reviews/due", headers=HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert "due_cards" in data
        assert "count" in data
        assert data["count"] == 1


# ---------------------------------------------------------------------------
# POST /api/reviews/attempt
# ---------------------------------------------------------------------------

class TestSubmitReviewAttempt:
    def test_submit_review_success(self, sr_client, sb):
        """Submitting a review attempt returns updated card."""
        sb.table.return_value = _make_query_mock(data=TEST_CARD_DATA)

        response = sr_client.post("/api/reviews/attempt", json={
            "question_id": TEST_QUESTION_ID,
            "quality_score": 4,
        }, headers=HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert "card" in data
        assert "next_review_date" in data

    def test_submit_review_invalid_quality(self, sr_client, sb):
        """Quality score outside 0-5 returns 422."""
        response = sr_client.post("/api/reviews/attempt", json={
            "question_id": TEST_QUESTION_ID,
            "quality_score": 10,
        }, headers=HEADERS)

        assert response.status_code == 422


# ---------------------------------------------------------------------------
# GET /api/reviews/stats
# ---------------------------------------------------------------------------

class TestGetReviewStats:
    def test_get_review_stats_success(self, sr_client, sb):
        """Getting review stats returns cards_due, reviewed_today, total."""
        sb.table.return_value = _make_query_mock(data=[], count=5)

        response = sr_client.get("/api/reviews/stats", headers=HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert "cards_due" in data
        assert "cards_reviewed_today" in data
        assert "total_cards" in data
