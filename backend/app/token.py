"""JWT access/refresh token helpers.

Tokens carry a subject (user id), an audience (client | mechanic) and a
purpose (access | refresh) so a refresh token can never be used as an
access token and client tokens can never hit mechanic routes.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from .config import settings

ALGORITHM = "HS256"
AUDIENCE_CLIENT = "client"
AUDIENCE_MECHANIC = "mechanic"
TYPE_ACCESS = "access"
TYPE_REFRESH = "refresh"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def create_access_token(subject: str, audience: str) -> str:
    return _encode(
        {
            "sub": str(subject),
            "aud": audience,
            "typ": TYPE_ACCESS,
            "iat": _now(),
            "exp": _now() + timedelta(minutes=settings.ACCESS_TOKEN_MINUTES),
        }
    )


def create_refresh_token(subject: str, audience: str) -> str:
    return _encode(
        {
            "sub": str(subject),
            "aud": audience,
            "typ": TYPE_REFRESH,
            "iat": _now(),
            "exp": _now() + timedelta(days=settings.REFRESH_TOKEN_DAYS),
        }
    )


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[ALGORITHM],
            audience=AUDIENCE_MECHANIC,
            options={"verify_aud": False},
        )
    except jwt.PyJWTError:
        return None


def validate_token(token: str, audience: str, token_type: str = TYPE_ACCESS) -> Optional[dict]:
    payload = decode_token(token)
    if not payload:
        return None
    if payload.get("aud") != audience:
        return None
    if payload.get("typ") != token_type:
        return None
    return payload
