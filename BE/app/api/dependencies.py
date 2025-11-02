from __future__ import annotations

from fastapi import Cookie, HTTPException, Response, status

from app.core.config import settings
from app.core.security import decode_access_token

AUTH_COOKIE_NAME = "bmr_at"


async def get_authenticated_user_id(token: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME)) -> str:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    return decode_access_token(token)


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        max_age=settings.ACCESS_TOKEN_EXPIRES,
        samesite="none",
        secure=True,
    )
