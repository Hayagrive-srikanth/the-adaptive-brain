"""Tests for gamification endpoints and gamification_service."""

import pytest
from unittest.mock import patch, MagicMock
from datetime import date
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
def gam_client(sb):
    with patch("app.api.auth.supabase", sb), \
         patch("app.api.auth.get_current_user_id", return_value=TEST_USER_ID), \
         patch("app.api.gamification.supabase", sb), \
         patch("app.api.gamification.create_client", return_value=sb):
        from app.main import app
        from fastapi.testclient import TestClient
        yield TestClient(app)


HEADERS = {"Authorization": "Bearer valid-token"}


# ---------------------------------------------------------------------------
# GET /api/gamification/stats
# ---------------------------------------------------------------------------

class TestGetStats:
    def test_get_stats_success(self, gam_client, sb):
        """Getting gamification stats returns XP, level, streak, daily progress."""
        profile_data = {
            "total_xp": 500,
            "level": 3,
            "current_streak": 5,
            "longest_streak": 12,
            "last_active_date": "2026-03-23",
        }
        settings_data = {"daily_xp_goal": 100}
        xp_data = [{"xp_earned": 40}, {"xp_earned": 30}]

        call_count = [0]

        def table_side_effect(name):
            call_count[0] += 1
            if name == "user_profiles":
                return _make_query_mock(data=profile_data)
            elif name == "user_settings":
                return _make_query_mock(data=settings_data)
            elif name == "xp_history":
                return _make_query_mock(data=xp_data)
            return _make_query_mock(data=[])

        sb.table.side_effect = table_side_effect

        response = gam_client.get("/api/gamification/stats", headers=HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert "total_xp" in data
        assert "level" in data
        assert "current_streak" in data
        assert "daily_xp" in data

    def test_get_stats_no_profile(self, gam_client, sb):
        """User without profile gets default stats."""
        sb.table.return_value = _make_query_mock(data=None)

        response = gam_client.get("/api/gamification/stats", headers=HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert data["total_xp"] == 0
        assert data["level"] == 1


# ---------------------------------------------------------------------------
# GET /api/gamification/achievements
# ---------------------------------------------------------------------------

class TestGetAchievements:
    def test_get_achievements_success(self, gam_client, sb):
        """Getting achievements returns earned achievement list."""
        achievements = [
            {"achievement_key": "first_session", "xp_awarded": 50, "created_at": "2026-03-01T10:00:00Z"},
            {"achievement_key": "streak_3", "xp_awarded": 100, "created_at": "2026-03-05T10:00:00Z"},
        ]
        sb.table.return_value = _make_query_mock(data=achievements)

        response = gam_client.get("/api/gamification/achievements", headers=HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert "achievements" in data
        assert "total_earned" in data

    def test_get_achievements_empty(self, gam_client, sb):
        """User with no achievements returns empty list."""
        sb.table.return_value = _make_query_mock(data=[])

        response = gam_client.get("/api/gamification/achievements", headers=HEADERS)

        assert response.status_code == 200
        assert response.json()["total_earned"] == 0


# ---------------------------------------------------------------------------
# GET /api/gamification/daily-goal
# ---------------------------------------------------------------------------

class TestGetDailyGoal:
    def test_get_daily_goal_success(self, gam_client, sb):
        """Getting daily goal returns progress info."""
        call_count = [0]

        def table_side_effect(name):
            call_count[0] += 1
            if name == "user_settings":
                return _make_query_mock(data={"daily_xp_goal": 100})
            elif name == "xp_history":
                return _make_query_mock(data=[
                    {"xp_earned": 50, "session_id": "s1", "breakdown": {}, "created_at": "2026-03-24T10:00:00Z"},
                ])
            return _make_query_mock(data=[])

        sb.table.side_effect = table_side_effect

        response = gam_client.get("/api/gamification/daily-goal", headers=HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert "daily_goal" in data
        assert "daily_xp" in data
        assert "goal_met" in data
        assert "progress_percent" in data


# ---------------------------------------------------------------------------
# POST /api/gamification/streak-freeze
# ---------------------------------------------------------------------------

class TestStreakFreeze:
    def test_streak_freeze_success(self, gam_client, sb):
        """Using streak freeze with valid conditions succeeds."""
        yesterday = (date.today() - __import__("datetime").timedelta(days=2)).isoformat()
        profile_data = {
            "current_streak": 10,
            "streak_freezes": 2,
            "last_active_date": yesterday,
        }
        sb.table.return_value = _make_query_mock(data=profile_data)

        response = gam_client.post("/api/gamification/streak-freeze", headers=HEADERS)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["streak_freezes_remaining"] == 1

    def test_streak_freeze_no_freezes_available(self, gam_client, sb):
        """Using streak freeze with none available returns 400."""
        profile_data = {
            "current_streak": 5,
            "streak_freezes": 0,
            "last_active_date": "2026-03-22",
        }
        sb.table.return_value = _make_query_mock(data=profile_data)

        response = gam_client.post("/api/gamification/streak-freeze", headers=HEADERS)

        assert response.status_code == 400

    def test_streak_freeze_not_needed(self, gam_client, sb):
        """Using streak freeze when streak is still active returns 400."""
        profile_data = {
            "current_streak": 5,
            "streak_freezes": 2,
            "last_active_date": date.today().isoformat(),
        }
        sb.table.return_value = _make_query_mock(data=profile_data)

        response = gam_client.post("/api/gamification/streak-freeze", headers=HEADERS)

        assert response.status_code == 400

    def test_streak_freeze_no_profile(self, gam_client, sb):
        """Using streak freeze without profile returns 404."""
        sb.table.return_value = _make_query_mock(data=None)

        response = gam_client.post("/api/gamification/streak-freeze", headers=HEADERS)

        assert response.status_code == 404


# ---------------------------------------------------------------------------
# calculate_session_xp() — service function
# ---------------------------------------------------------------------------

class TestCalculateSessionXp:
    @patch("app.services.gamification_service.supabase")
    def test_calculate_session_xp_basic(self, mock_sb):
        """calculate_session_xp returns base_xp + accuracy_xp + consistency_bonus."""
        session_data = {
            "id": TEST_SESSION_ID,
            "user_id": TEST_USER_ID,
            "project_id": "proj-1",
        }
        topics_data = [{"id": "t1"}, {"id": "t2"}]
        answers_data = [
            {"is_correct": True, "created_at": "2026-03-24T10:00:00Z"},
            {"is_correct": True, "created_at": "2026-03-24T10:01:00Z"},
            {"is_correct": False, "created_at": "2026-03-24T10:02:00Z"},
        ]

        call_count = [0]

        def table_side_effect(name):
            call_count[0] += 1
            if name == "study_sessions":
                return _make_query_mock(data=session_data)
            elif name == "session_topics":
                return _make_query_mock(data=topics_data)
            elif name == "quiz_answers":
                return _make_query_mock(data=answers_data)
            elif name == "user_settings":
                return _make_query_mock(data={"daily_xp_goal": 100})
            elif name == "xp_history":
                return _make_query_mock(data=[])
            elif name == "user_profiles":
                return _make_query_mock(data={"total_xp": 100, "level": 2})
            return _make_query_mock(data=[])

        mock_sb.table.side_effect = table_side_effect

        from app.services.gamification_service import calculate_session_xp
        result = calculate_session_xp(TEST_SESSION_ID)

        assert "total_xp" in result
        assert "base_xp" in result
        assert "accuracy_xp" in result
        assert result["base_xp"] == 20  # 2 topics * 10
        assert result["topics_covered"] == 2

    @patch("app.services.gamification_service.supabase")
    def test_calculate_session_xp_session_not_found(self, mock_sb):
        """calculate_session_xp raises ValueError for missing session."""
        mock_sb.table.return_value = _make_query_mock(data=None)

        from app.services.gamification_service import calculate_session_xp
        with pytest.raises(ValueError, match="not found"):
            calculate_session_xp("nonexistent")


# ---------------------------------------------------------------------------
# update_streak() — service function
# ---------------------------------------------------------------------------

class TestUpdateStreak:
    @patch("app.services.gamification_service.supabase")
    def test_update_streak_consecutive_day(self, mock_sb):
        """update_streak increments streak for consecutive day."""
        yesterday = (date.today() - __import__("datetime").timedelta(days=1)).isoformat()
        mock_sb.table.return_value = _make_query_mock(data={
            "current_streak": 5,
            "longest_streak": 10,
            "last_active_date": yesterday,
            "streak_freezes": 1,
        })

        from app.services.gamification_service import update_streak
        result = update_streak(TEST_USER_ID)

        assert result["current_streak"] == 6
        assert result["streak_maintained"] is True

    @patch("app.services.gamification_service.supabase")
    def test_update_streak_same_day(self, mock_sb):
        """update_streak on same day returns unchanged streak."""
        mock_sb.table.return_value = _make_query_mock(data={
            "current_streak": 5,
            "longest_streak": 10,
            "last_active_date": date.today().isoformat(),
            "streak_freezes": 1,
        })

        from app.services.gamification_service import update_streak
        result = update_streak(TEST_USER_ID)

        assert result["current_streak"] == 5
        assert result["streak_maintained"] is True

    @patch("app.services.gamification_service.supabase")
    def test_update_streak_broken(self, mock_sb):
        """update_streak resets streak when gap > 2 days."""
        old_date = (date.today() - __import__("datetime").timedelta(days=5)).isoformat()
        mock_sb.table.return_value = _make_query_mock(data={
            "current_streak": 15,
            "longest_streak": 15,
            "last_active_date": old_date,
            "streak_freezes": 0,
        })

        from app.services.gamification_service import update_streak
        result = update_streak(TEST_USER_ID)

        assert result["current_streak"] == 1
        assert result["streak_maintained"] is False

    @patch("app.services.gamification_service.supabase")
    def test_update_streak_new_user(self, mock_sb):
        """update_streak for user with no profile initializes to 1."""
        mock_sb.table.return_value = _make_query_mock(data=None)

        from app.services.gamification_service import update_streak
        result = update_streak(TEST_USER_ID)

        assert result["current_streak"] == 1
        assert result["streak_maintained"] is True


# ---------------------------------------------------------------------------
# check_achievements() — service function
# ---------------------------------------------------------------------------

class TestCheckAchievements:
    @patch("app.services.gamification_service.supabase")
    def test_check_achievements_first_session(self, mock_sb):
        """First session triggers 'first_session' achievement."""
        call_count = [0]

        def table_side_effect(name):
            call_count[0] += 1
            if name == "user_achievements":
                if call_count[0] <= 2:
                    # No earned achievements yet
                    return _make_query_mock(data=[])
                else:
                    return _make_query_mock(data=[{"id": "ach-1"}])
            elif name == "user_profiles":
                return _make_query_mock(data={"total_xp": 0, "level": 1, "current_streak": 0})
            elif name == "xp_history":
                return _make_query_mock(data=[])
            return _make_query_mock(data=[])

        mock_sb.table.side_effect = table_side_effect

        from app.services.gamification_service import check_achievements
        result = check_achievements(TEST_USER_ID, "session_complete", {"hour": 14})

        assert any(a["key"] == "first_session" for a in result)

    @patch("app.services.gamification_service.supabase")
    def test_check_achievements_already_earned(self, mock_sb):
        """Already-earned achievements are not re-awarded."""
        mock_sb.table.side_effect = lambda name: (
            _make_query_mock(data=[{"achievement_key": "first_session"}])
            if name == "user_achievements"
            else _make_query_mock(data={"total_xp": 100, "level": 2, "current_streak": 1})
        )

        from app.services.gamification_service import check_achievements
        result = check_achievements(TEST_USER_ID, "session_complete", {"hour": 14})

        assert not any(a["key"] == "first_session" for a in result)


# ---------------------------------------------------------------------------
# _calculate_level() — helper function
# ---------------------------------------------------------------------------

class TestCalculateLevel:
    def test_level_1_zero_xp(self):
        """0 XP = level 1."""
        from app.services.gamification_service import _calculate_level
        assert _calculate_level(0) == 1

    def test_level_2_at_100_xp(self):
        """100 XP = level 2 (threshold: 50*1*2 = 100)."""
        from app.services.gamification_service import _calculate_level
        assert _calculate_level(100) == 2

    def test_level_3_at_300_xp(self):
        """300 XP = level 3 (threshold: 50*2*3 = 300)."""
        from app.services.gamification_service import _calculate_level
        assert _calculate_level(300) == 3

    def test_level_4_at_600_xp(self):
        """600 XP = level 4 (threshold: 50*3*4 = 600)."""
        from app.services.gamification_service import _calculate_level
        assert _calculate_level(600) == 4

    def test_level_just_below_threshold(self):
        """99 XP is still level 1."""
        from app.services.gamification_service import _calculate_level
        assert _calculate_level(99) == 1
