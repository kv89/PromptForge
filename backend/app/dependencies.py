"""Shared FastAPI dependencies, including authentication."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.models.user import User, UserRole

_bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> User:
    """Resolve the authenticated :class:`User` from a Firebase ID token.

    Reads a Bearer token from the ``Authorization`` header, verifies it with the
    Firebase Admin SDK, and maps the decoded claims onto a :class:`User`. Raises
    an HTTP 401 if the token is missing or invalid.

    This is a placeholder: role resolution is not yet wired to a persistent
    store, so every authenticated user currently defaults to ``EDITOR``.
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        from firebase_admin import auth as firebase_auth

        decoded = firebase_auth.verify_id_token(credentials.credentials)
    except Exception as exc:  # noqa: BLE001 - any verification failure is a 401
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    return User(
        uid=decoded.get("uid") or decoded.get("user_id") or decoded.get("sub", ""),
        email=decoded.get("email", ""),
        display_name=decoded.get("name", decoded.get("email", "")),
        role=UserRole.EDITOR,
        created_at=datetime.now(timezone.utc),
    )
