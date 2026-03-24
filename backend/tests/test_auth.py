"""Tests for authentication endpoints (POST /api/auth/signup, signin, GET /api/auth/me)."""

import pytest
from unittest.mock import patch, MagicMock
from tests.conftest import (
    _make_supabase_mock,
    _make_query_mock,
    TEST_USER_ID,
    TEST_USER_EMAIL,
    TEST_USER_NAME,
    TEST_USER_DATA,
)


@pytest.fixture
def sb():
    return _make_supabase_mock()


@pytest.fixture
def auth_client(sb):
    with patch("app.api.auth.supabase", sb), \
         patch("app.api.auth.create_client", return_value=sb):
        from app.main import app
        from fastapi.testclient import TestClient
        yield TestClient(app)


# ---------------------------------------------------------------------------
# POST /api/auth/signup
# ---------------------------------------------------------------------------

class TestSignup:
    def test_signup_success(self, auth_client, sb):
        """Successful signup returns user_id, email, and tokens."""
        sb.table.return_value = _make_query_mock(data=[{"id": TEST_USER_ID}])

        response = auth_client.post("/api/auth/signup", json={
            "email": TEST_USER_EMAIL,
            "name": TEST_USER_NAME,
            "password": "SecurePass123!",
        })

        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == TEST_USER_ID
        assert data["email"] == TEST_USER_EMAIL
        assert "access_token" in data
        assert "refresh_token" in data

    def test_signup_failed_auth(self, auth_client, sb):
        """Signup fails when Supabase auth returns no user."""
        sb.auth.sign_up.return_value = MagicMock(user=None, session=None)

        response = auth_client.post("/api/auth/signup", json={
            "email": "bad@example.com",
            "name": "Bad User",
            "password": "pass",
        })

        assert response.status_code == 400

    def test_signup_missing_fields(self, auth_client):
        """Signup with missing required fields returns 422."""
        response = auth_client.post("/api/auth/signup", json={
            "email": TEST_USER_EMAIL,
        })

        assert response.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/auth/signin
# ---------------------------------------------------------------------------

class TestSignin:
    def test_signin_success(self, auth_client, sb):
        """Successful signin returns user_id, email, and tokens."""
        response = auth_client.post(
            "/api/auth/signin",
            params={"email": TEST_USER_EMAIL, "password": "SecurePass123!"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == TEST_USER_ID
        assert data["email"] == TEST_USER_EMAIL
        assert "access_token" in data
        assert "refresh_token" in data

    def test_signin_invalid_credentials(self, auth_client, sb):
        """Signin with wrong password returns 401."""
        sb.auth.sign_in_with_password.return_value = MagicMock(user=None, session=None)

        response = auth_client.post(
            "/api/auth/signin",
            params={"email": TEST_USER_EMAIL, "password": "wrong"},
        )

        assert response.status_code == 401

    def test_signin_exception_returns_401(self, auth_client, sb):
        """Signin that raises an exception returns 401."""
        sb.auth.sign_in_with_password.side_effect = Exception("connection error")

        response = auth_client.post(
            "/api/auth/signin",
            params={"email": TEST_USER_EMAIL, "password": "any"},
        )

        assert response.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------

class TestGetMe:
    def test_get_me_success(self, auth_client, sb):
        """GET /me with valid token returns user data."""
        sb.table.return_value = _make_query_mock(data=TEST_USER_DATA)

        response = auth_client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer valid-token"},
        )

        assert response.status_code == 200

    def test_get_me_missing_auth_header(self, auth_client):
        """GET /me without Authorization header returns 422."""
        response = auth_client.get("/api/auth/me")

        assert response.status_code == 422

    def test_get_me_invalid_token(self, auth_client, sb):
        """GET /me with invalid token returns 401."""
        sb.auth.get_user.side_effect = Exception("invalid token")

        response = auth_client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer bad-token"},
        )

        assert response.status_code == 401

    def test_get_me_user_not_found(self, auth_client, sb):
        """GET /me returns 404 when user record not found in users table."""
        sb.table.return_value = _make_query_mock(data=None)

        response = auth_client.get(
            "/api/auth/me",
            headers={"Authorization": "Bearer valid-token"},
        )

        assert response.status_code == 404
