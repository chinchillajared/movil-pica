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
    if crud.get_client_by_phone(db, payload.phone):
        raise HTTPException(status_code=409, detail="phone already registered")
    if payload.email and crud.get_client_by_email(db, payload.email):
        raise HTTPException(status_code=409, detail="email already registered")
    try:
        client = crud.create_client(db, payload, hash_password(payload.password))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if client.email:
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
    client = crud.get_client_by_identifier(db, payload.identifier)
    if not client:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="client_not_registered",
        )
    if not verify_password(payload.password, client.password_hash):
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


@router.put("/me", response_model=schemas.ClientOut)
def update_me(
    payload: schemas.ClientUpdate,
    client=Depends(require_client),
    db: Session = Depends(get_db),
):
    try:
        updated = crud.update_client_profile(db, client, payload)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return schemas.ClientOut.model_validate(updated)


# --------------------------------------------------------------------------
# Client vehicles (mis vehículos)
# --------------------------------------------------------------------------
@router.get("/vehicles", response_model=list[schemas.VehicleSummaryOut])
def my_vehicles(client=Depends(require_client), db: Session = Depends(get_db)):
    return crud.list_vehicles_by_client(db, client.id)


@router.get(
    "/appointments",
    response_model=list[schemas.ClientAppointmentOut],
    dependencies=[Depends(rate_limit(max_requests=60, window_seconds=60))],
)
def my_appointments(client=Depends(require_client), db: Session = Depends(get_db)):
    return [
        schemas.ClientAppointmentOut.model_validate(a)
        for a in crud.list_client_appointments(db, client)
    ]


@router.get(
    "/repairs",
    response_model=list[schemas.ServiceRecordOut],
    dependencies=[Depends(rate_limit(max_requests=60, window_seconds=60))],
)
def my_repairs(client=Depends(require_client), db: Session = Depends(get_db)):
    vehicles = crud.list_vehicles_by_client(db, client.id)
    vehicle_ids = [v.id for v in vehicles]
    return [
        _service_record_out(r)
        for r in crud.list_service_records_for_vehicles(db, vehicle_ids)
    ]


def _service_record_out(record) -> schemas.ServiceRecordOut:
    out = schemas.ServiceRecordOut.model_validate(record)
    total = 0.0
    for row in record.price_rows:
        if row.amount is not None:
            total += float(row.amount)
    out.total = round(total, 2)
    return out


@router.post(
    "/vehicles",
    response_model=schemas.VehicleOut,
    status_code=status.HTTP_201_CREATED,
)
def register_vehicle(
    payload: schemas.VehicleBase,
    client=Depends(require_client),
    db: Session = Depends(get_db),
):
    try:
        obj = crud.create_or_link_client_vehicle(db, client.id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    from ..event_manager import event_manager

    event_manager.publish("vehicle", {"type": "updated"})
    return obj


@router.put("/vehicles/{vehicle_id}", response_model=schemas.VehicleOut)
def update_my_vehicle(
    vehicle_id: int,
    payload: schemas.VehicleUpdate,
    client=Depends(require_client),
    db: Session = Depends(get_db),
):
    if crud.get_client_vehicle(db, client.id, vehicle_id) is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    try:
        obj = crud.update_vehicle(db, vehicle_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    from ..event_manager import event_manager

    event_manager.publish("vehicle", {"type": "updated"})
    return obj


@router.delete("/vehicles/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_vehicle(
    vehicle_id: int,
    client=Depends(require_client),
    db: Session = Depends(get_db),
):
    try:
        crud.unlink_client_vehicle(db, client.id, vehicle_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    from ..event_manager import event_manager

    event_manager.publish("vehicle", {"type": "updated"})
    return None
