from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..database import get_db
from ..deps import require_client
from ..email_sender import send_account_email
from ..models import Client
from ..ratelimit import rate_limit
from ..security import hash_password, verify_password
from ..token import (
    AUDIENCE_CLIENT,
    TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    validate_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_PASSWORD_MIN = schemas._PASSWORD_MIN


def _auth_response(client) -> schemas.ClientAuthResponse:
    subject = str(client.id)
    return schemas.ClientAuthResponse(
        access_token=create_access_token(subject, AUDIENCE_CLIENT),
        refresh_token=create_refresh_token(subject, AUDIENCE_CLIENT),
        client=schemas.ClientOut.model_validate(client),
    )


@router.post(
    "/register",
    response_model=schemas.ClientAuthResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))],
)
def register(payload: schemas.ClientRegister, db: Session = Depends(get_db)):
    if crud.get_client_by_email(db, payload.email):
        raise HTTPException(status_code=409, detail="email already registered")
    client = crud.create_client(db, payload, hash_password(payload.password))
    html = f"""
    <html><body style="font-family:sans-serif">
      <h2 style="color:#1d4ed8">¡Bienvenido, {client.first_name}!</h2>
      <p>Tu cuenta fue creada correctamente. Ya puedes agendar citas.</p>
      <p style="color:#64748b">Welcome, {client.first_name}! Your account is ready.</p>
    </body></html>"""
    send_account_email(db, client.email, "Cuenta creada / Account created", html)
    return _auth_response(client)


@router.post(
    "/login",
    response_model=schemas.ClientAuthResponse,
    dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))],
)
def login(payload: schemas.ClientLogin, db: Session = Depends(get_db)):
    client = crud.get_client_by_email(db, payload.email)
    if not client or not verify_password(payload.password, client.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    return _auth_response(client)


@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    parsed = validate_token(payload.refresh_token, AUDIENCE_CLIENT, TYPE_REFRESH)
    if not parsed:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )
    client = db.get(Client, int(parsed["sub"]))
    if not client:
        raise HTTPException(status_code=401, detail="Client not found")
    return schemas.TokenResponse(
        access_token=create_access_token(str(client.id), AUDIENCE_CLIENT)
    )


@router.get("/me", response_model=schemas.ClientOut)
def me(client=Depends(require_client)):
    return schemas.ClientOut.model_validate(client)
