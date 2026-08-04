from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import token as token_mod
from .database import get_db
from .models import Client, User

bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "Invalid or expired session"):
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def require_mechanic(
    x_mechanic_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    if x_mechanic_key is None:
        raise _unauthorized()
    payload = token_mod.validate_token(x_mechanic_key, token_mod.AUDIENCE_MECHANIC)
    if not payload:
        raise _unauthorized()
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise _unauthorized("User not found or inactive")
    return user


def require_admin(user: User = Depends(require_mechanic)) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return user


def require_client(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Client:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _unauthorized()
    payload = token_mod.validate_token(
        credentials.credentials, token_mod.AUDIENCE_CLIENT
    )
    if not payload:
        raise _unauthorized()
    client = db.get(Client, int(payload["sub"]))
    if not client:
        raise _unauthorized("Client not found")
    return client
