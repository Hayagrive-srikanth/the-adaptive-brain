from fastapi import APIRouter, HTTPException, Header
from typing import Optional
from supabase import create_client
from app.config import settings
from app.models.schemas import UserCreate, UserResponse

router = APIRouter()
supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


async def get_current_user_id(authorization: str = Header(...)) -> str:
    """Extract and validate user ID from Supabase JWT token."""
    try:
        token = authorization.replace("Bearer ", "")
        user = supabase.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user.user.id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@router.post("/signup")
async def signup(data: UserCreate):
    """Create a new user account."""
    try:
        # Create user in Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": data.email,
            "password": data.password,
        })

        if not auth_response.user:
            raise HTTPException(status_code=400, detail="Failed to create account")

        user_id = auth_response.user.id

        # Create user record in users table
        supabase.table("users").insert({
            "id": user_id,
            "email": data.email,
            "name": data.name,
        }).execute()

        return {
            "user_id": user_id,
            "email": data.email,
            "access_token": auth_response.session.access_token if auth_response.session else None,
            "refresh_token": auth_response.session.refresh_token if auth_response.session else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/signin")
async def signin(email: str, password: str):
    """Sign in an existing user."""
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password,
        })

        if not auth_response.user:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        return {
            "user_id": auth_response.user.id,
            "email": auth_response.user.email,
            "access_token": auth_response.session.access_token,
            "refresh_token": auth_response.session.refresh_token,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/signout")
async def signout(authorization: str = Header(...)):
    """Sign out the current user."""
    try:
        token = authorization.replace("Bearer ", "")
        supabase.auth.sign_out()
        return {"message": "Signed out successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/me")
async def get_me(authorization: str = Header(...)):
    """Get the current authenticated user."""
    try:
        user_id = await get_current_user_id(authorization)

        result = supabase.table("users").select("*").eq("id", user_id).single().execute()

        if not result.data:
            raise HTTPException(status_code=404, detail="User not found")

        return result.data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
