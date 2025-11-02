from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Cookie, Depends, Response, status

from app.api.dependencies import AUTH_COOKIE_NAME, get_authenticated_user_id, set_auth_cookie
from app.core.security import create_access_token, decode_access_token
from app.models import AuthResponse

router = APIRouter()


@router.post("/auth", response_model=AuthResponse, status_code=status.HTTP_200_OK)
async def issue_token(
    response: Response,
    existing_token: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
) -> AuthResponse:
    """Issue or refresh an access token and set the authentication cookie."""

    if existing_token:
        try:
            user_id = decode_access_token(existing_token)
        except Exception:
            user_id = f"user_{uuid4().hex[:10]}"
    else:
        user_id = f"user_{uuid4().hex[:10]}"

    token = create_access_token(user_id)
    set_auth_cookie(response, token)
    return AuthResponse(access_token=token, user_id=user_id)


@router.get("/auth/me", response_model=AuthResponse)
async def auth_me(
    response: Response,
    user_id: str = Depends(get_authenticated_user_id),
) -> AuthResponse:
    token = create_access_token(user_id)
    set_auth_cookie(response, token)
    return AuthResponse(access_token=token, user_id=user_id)
