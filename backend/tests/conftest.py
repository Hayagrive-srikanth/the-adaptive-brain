"""Shared test fixtures for The Adaptive Brain backend tests."""

import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Test data constants
# ---------------------------------------------------------------------------

TEST_USER_ID = "user-uuid-1234-5678-abcd"
TEST_USER_EMAIL = "student@example.com"
TEST_USER_NAME = "Test Student"
TEST_USER_PROFILE = {
    "learning_modality": "visual",
    "attention_span_minutes": 25,
    "engagement_style": "moderate",
    "language": {
        "first_language": "en",
        "english_comfort": "native",
    },
    "neurodivergent": {
        "adhd": False,
        "dyslexia": False,
        "autism": False,
        "other": None,
    },
    "study_time_preference": "evening",
    "motivation_type": "progress_stats",
    "custom_notes": "",
}

TEST_USER_DATA = {
    "id": TEST_USER_ID,
    "email": TEST_USER_EMAIL,
    "name": TEST_USER_NAME,
    "profile": TEST_USER_PROFILE,
    "total_xp": 500,
    "current_streak": 5,
    "longest_streak": 12,
    "last_active_date": "2026-03-20",
    "onboarding_completed": True,
    "created_at": "2026-01-15T10:00:00Z",
}

TEST_PROJECT_ID = "proj-uuid-1234-5678-abcd"
TEST_PROJECT_DATA = {
    "id": TEST_PROJECT_ID,
    "user_id": TEST_USER_ID,
    "name": "Organic Chemistry Final",
    "exam_date": "2026-05-15",
    "hours_per_day": 2.0,
    "comfort_level": "intermediate",
    "readiness_score": 45.5,
    "status": "active",
    "created_at": "2026-03-01T08:00:00Z",
    "updated_at": "2026-03-20T18:00:00Z",
}

TEST_TOPIC_ID = "topic-uuid-1234-5678-abcd"
TEST_TOPIC_DATA = {
    "id": TEST_TOPIC_ID,
    "project_id": TEST_PROJECT_ID,
    "name": "Chemical Bonding",
    "description": "Types of chemical bonds including ionic, covalent, and metallic.",
    "difficulty": "intermediate",
    "prerequisite_ids": [],
    "mastery_percentage": 65.0,
    "status": "in_progress",
    "estimated_minutes": 45,
    "path_order": 1,
    "source_material_ids": ["mat-uuid-1"],
    "created_at": "2026-03-01T10:00:00Z",
}

TEST_SESSION_ID = "session-uuid-1234-5678-abcd"
TEST_SESSION_DATA = {
    "id": TEST_SESSION_ID,
    "project_id": TEST_PROJECT_ID,
    "plan_day_id": None,
    "started_at": "2026-03-20T14:00:00Z",
    "ended_at": None,
    "duration_minutes": None,
    "topics_covered": [],
    "session_type": "new_material",
    "completed": False,
    "xp_earned": 0,
}

TEST_QUESTION_ID = "question-uuid-1234-5678-abcd"
TEST_QUESTION_DATA = {
    "id": TEST_QUESTION_ID,
    "topic_id": TEST_TOPIC_ID,
    "question_type": "multiple_choice",
    "question_text": "Which type of bond involves sharing of electrons?",
    "options": {"A": "Ionic", "B": "Covalent", "C": "Metallic", "D": "Hydrogen"},
    "correct_answer": "B",
    "explanation": "Covalent bonds involve sharing of electron pairs between atoms.",
    "difficulty": "medium",
    "hint_layers": ["Think about what sharing means in chemistry.", "Electrons are shared, not transferred."],
    "times_shown": 5,
    "times_correct": 3,
}

TEST_MATERIAL_ID = "mat-uuid-1234-5678-abcd"
TEST_MATERIAL_DATA = {
    "id": TEST_MATERIAL_ID,
    "project_id": TEST_PROJECT_ID,
    "original_filename": "chemistry_notes.pdf",
    "file_type": "pdf",
    "storage_path": f"{TEST_PROJECT_ID}/{TEST_MATERIAL_ID}.pdf",
    "processing_status": "completed",
    "ocr_text": "Chapter 1: Chemical Bonding ...",
    "page_count": 10,
    "created_at": "2026-03-01T09:00:00Z",
}

TEST_PLAN_ID = "plan-uuid-1234-5678-abcd"
TEST_PLAN_DATA = {
    "id": TEST_PLAN_ID,
    "project_id": TEST_PROJECT_ID,
    "total_days": 30,
    "daily_target_minutes": 120,
    "status": "active",
    "generated_at": "2026-03-01T10:00:00Z",
    "regenerated_count": 0,
}

TEST_CARD_ID = "card-uuid-1234-5678-abcd"
TEST_CARD_DATA = {
    "id": TEST_CARD_ID,
    "user_id": TEST_USER_ID,
    "question_id": TEST_QUESTION_ID,
    "easiness_factor": 2.5,
    "interval": 1,
    "repetition": 0,
    "next_review_date": "2026-03-21",
    "total_reviews": 0,
    "last_quality_score": None,
    "last_reviewed_at": None,
}


# ---------------------------------------------------------------------------
# Helper: chainable mock for Supabase query builder
# ---------------------------------------------------------------------------

def _make_query_mock(data=None, count=None):
    """Create a chainable mock that mimics the Supabase query builder pattern."""
    mock = MagicMock()
    result = MagicMock()
    result.data = data
    result.count = count

    # Every chained method returns the same mock so calls like
    # supabase.table("x").select("*").eq("id", "1").single().execute()
    # all resolve to the same terminal .execute() -> result
    for method_name in (
        "select", "insert", "update", "delete", "upsert",
        "eq", "neq", "gt", "gte", "lt", "lte", "in_",
        "order", "limit", "single", "range",
    ):
        getattr(mock, method_name).return_value = mock

    mock.execute.return_value = result
    return mock


def _make_supabase_mock():
    """Build a mock Supabase client with a configurable .table() helper."""
    sb = MagicMock()

    # Default: .table(...) returns a generic query builder that yields empty data
    sb.table.return_value = _make_query_mock(data=[])

    # Storage mock
    bucket_mock = MagicMock()
    bucket_mock.upload.return_value = None
    bucket_mock.download.return_value = b"fake file bytes"
    bucket_mock.remove.return_value = None
    sb.storage.from_.return_value = bucket_mock

    # Auth mock
    sb.auth.get_user.return_value = MagicMock(
        user=MagicMock(id=TEST_USER_ID, email=TEST_USER_EMAIL)
    )
    auth_session = MagicMock(access_token="test-access-token", refresh_token="test-refresh-token")
    auth_user = MagicMock(id=TEST_USER_ID, email=TEST_USER_EMAIL)
    sb.auth.sign_up.return_value = MagicMock(user=auth_user, session=auth_session)
    sb.auth.sign_in_with_password.return_value = MagicMock(user=auth_user, session=auth_session)
    sb.auth.sign_out.return_value = None

    return sb


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_supabase():
    """Provide a mock Supabase client."""
    return _make_supabase_mock()


@pytest.fixture
def mock_openai():
    """Provide a mock OpenAI client."""
    client = MagicMock()
    choice = MagicMock()
    choice.message.content = '{"result": "ok"}'
    response = MagicMock()
    response.choices = [choice]
    client.chat.completions.create.return_value = response
    return client


@pytest.fixture
def mock_redis():
    """Provide a mock Redis client."""
    r = MagicMock()
    r.get.return_value = None
    r.set.return_value = True
    r.delete.return_value = True
    r.exists.return_value = False
    return r


@pytest.fixture
def auth_header():
    """Provide a valid Authorization header for tests."""
    return {"Authorization": "Bearer test-jwt-token-12345"}


@pytest.fixture
def test_user():
    """Provide test user data."""
    return TEST_USER_DATA.copy()


@pytest.fixture
def test_project():
    """Provide test project data."""
    return TEST_PROJECT_DATA.copy()


@pytest.fixture
def test_topic():
    """Provide test topic data."""
    return TEST_TOPIC_DATA.copy()


@pytest.fixture
def test_session():
    """Provide test session data."""
    return TEST_SESSION_DATA.copy()


@pytest.fixture
def test_question():
    """Provide test question data."""
    return TEST_QUESTION_DATA.copy()


@pytest.fixture
def test_material():
    """Provide test material data."""
    return TEST_MATERIAL_DATA.copy()


@pytest.fixture
def client(mock_supabase):
    """Provide a FastAPI TestClient with mocked Supabase."""
    with patch("app.api.auth.supabase", mock_supabase), \
         patch("app.api.auth.create_client", return_value=mock_supabase), \
         patch("app.api.projects.supabase", mock_supabase), \
         patch("app.api.projects.create_client", return_value=mock_supabase), \
         patch("app.api.materials.supabase", mock_supabase), \
         patch("app.api.materials.create_client", return_value=mock_supabase), \
         patch("app.api.topics.supabase", mock_supabase), \
         patch("app.api.topics.create_client", return_value=mock_supabase), \
         patch("app.api.sessions.supabase", mock_supabase), \
         patch("app.api.sessions.create_client", return_value=mock_supabase), \
         patch("app.api.quiz.supabase", mock_supabase), \
         patch("app.api.quiz.create_client", return_value=mock_supabase), \
         patch("app.api.study_plans.supabase", mock_supabase), \
         patch("app.api.study_plans.create_client", return_value=mock_supabase), \
         patch("app.api.spaced_repetition.supabase", mock_supabase), \
         patch("app.api.spaced_repetition.create_client", return_value=mock_supabase), \
         patch("app.api.wellbeing.supabase", mock_supabase), \
         patch("app.api.wellbeing.create_client", return_value=mock_supabase), \
         patch("app.api.gamification.supabase", mock_supabase), \
         patch("app.api.gamification.create_client", return_value=mock_supabase):
        from app.main import app
        yield TestClient(app)
