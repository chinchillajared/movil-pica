from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from .. import crud, schemas
from ..config import settings
from ..database import get_db
from ..deps import require_admin, require_mechanic
from ..email_sender import (
    GmailSendError,
    exchange_code_for_tokens,
    gmail_redirect_uri,
    send_account_email,
    send_html_email,
    _gmail_authorize_url,
)
from ..event_manager import event_manager
from ..models import User
from ..ratelimit import rate_limit
from ..security import hash_password, verify_password
from ..token import (
    AUDIENCE_MECHANIC,
    TYPE_REFRESH,
    create_access_token,
    create_refresh_token,
    validate_token,
)

router = APIRouter(prefix="/api/mechanic", tags=["mechanic"])


# --------------------------------------------------------------------------
# First-run setup (no users exist yet => create the main admin account)
# --------------------------------------------------------------------------
@router.get(
    "/bootstrap",
    response_model=schemas.BootstrapStatus,
    dependencies=[Depends(rate_limit(max_requests=30, window_seconds=60))],
)
def bootstrap_status(db: Session = Depends(get_db)):
    return schemas.BootstrapStatus(needs_setup=crud.count_users(db) == 0)


@router.post(
    "/bootstrap",
    response_model=schemas.MechanicAuthResponse,
    dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))],
)
def bootstrap_setup(payload: schemas.AdminSetup, db: Session = Depends(get_db)):
    if crud.count_users(db) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Setup already completed",
        )
    if crud.get_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )
    user = crud.create_user(
        db,
        schemas.UserCreate(
            name=payload.name,
            email=payload.email,
            password=payload.password,
            role="admin",
        ),
        hash_password(payload.password),
    )
    if payload.logo_data_url:
        crud.update_site_settings(db, payload.logo_data_url)
    return schemas.MechanicAuthResponse(
        token=create_access_token(str(user.id), AUDIENCE_MECHANIC),
        refresh_token=create_refresh_token(str(user.id), AUDIENCE_MECHANIC),
        user=schemas.UserOut.model_validate(user),
    )


# --------------------------------------------------------------------------
# Authentication (accounts with roles)
# --------------------------------------------------------------------------
@router.post(
    "/login",
    response_model=schemas.MechanicAuthResponse,
    dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))],
)
def login(payload: schemas.MechanicLogin, db: Session = Depends(get_db)):
    user = crud.get_user_by_email(db, payload.email)
    if not user or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    return schemas.MechanicAuthResponse(
        token=create_access_token(str(user.id), AUDIENCE_MECHANIC),
        refresh_token=create_refresh_token(str(user.id), AUDIENCE_MECHANIC),
        user=schemas.UserOut.model_validate(user),
    )


@router.post("/refresh", response_model=schemas.TokenResponse)
def refresh(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    parsed = validate_token(payload.refresh_token, AUDIENCE_MECHANIC, TYPE_REFRESH)
    if not parsed:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user = db.get(User, int(parsed["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return schemas.TokenResponse(
        access_token=create_access_token(str(user.id), AUDIENCE_MECHANIC)
    )


@router.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(require_mechanic)):
    return schemas.UserOut.model_validate(user)


@router.put("/me/password", response_model=schemas.UserOut)
def change_password(
    payload: schemas.PasswordChange,
    user: User = Depends(require_mechanic),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    updated = crud.update_user_password(db, user, hash_password(payload.new_password))
    html = (
        "<html><body style='font-family:sans-serif'>"
        "<p>Tu contraseña del panel del mecánico fue cambiada correctamente.</p>"
        "<p style='color:#64748b'>Your mechanic panel password was changed.</p>"
        "</body></html>"
    )
    send_account_email(db, user.email, "Contraseña actualizada / Password updated", html)
    return schemas.UserOut.model_validate(updated)


# --------------------------------------------------------------------------
# User management (admin only)
# --------------------------------------------------------------------------
@router.get("/users", response_model=list[schemas.UserOut])
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return [schemas.UserOut.model_validate(u) for u in crud.list_users(db)]


@router.get(
    "/technicians",
    response_model=list[schemas.TechnicianOut],
    dependencies=[Depends(require_mechanic)],
)
def list_technicians(db: Session = Depends(get_db)):
    return [schemas.TechnicianOut.model_validate(u) for u in crud.list_technicians(db)]


@router.post(
    "/users",
    response_model=schemas.UserOut,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: schemas.UserCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if crud.get_user_by_email(db, payload.email):
        raise HTTPException(status_code=409, detail="email already registered")
    user = crud.create_user(db, payload, hash_password(payload.password))
    html = (
        "<html><body style='font-family:sans-serif'>"
        f"<p>Hola {user.name}, se creó una cuenta para ti en el panel del mecánico.</p>"
        f"<p>Email: {user.email}</p>"
        "<p style='color:#64748b'>An account was created for you on the mechanic panel.</p>"
        "</body></html>"
    )
    send_account_email(db, user.email, "Cuenta de mecánico creada / Mechanic account created", html)
    return schemas.UserOut.model_validate(user)


@router.put("/users/{user_id}", response_model=schemas.UserOut)
def update_user(
    user_id: int,
    payload: schemas.UserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id and payload.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    updated = crud.update_user(db, user, payload)
    return schemas.UserOut.model_validate(updated)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    crud.delete_user(db, user)
    return None


@router.get("/reminders", response_model=list[schemas.ReminderOut])
def list_reminders(user: User = Depends(require_mechanic), db: Session = Depends(get_db)):
    return [schemas.ReminderOut.model_validate(r) for r in crud.list_reminders(db, user.id)]


@router.post("/reminders", response_model=schemas.ReminderOut, status_code=status.HTTP_201_CREATED)
def create_reminder(
    payload: schemas.ReminderCreate,
    user: User = Depends(require_mechanic),
    db: Session = Depends(get_db),
):
    reminder = crud.create_reminder(db, user.id, payload)
    return schemas.ReminderOut.model_validate(reminder)


@router.patch("/reminders/{reminder_id}", response_model=schemas.ReminderOut)
def update_reminder(
    reminder_id: int,
    payload: schemas.ReminderUpdate,
    user: User = Depends(require_mechanic),
    db: Session = Depends(get_db),
):
    reminder = crud.get_reminder(db, reminder_id, user.id)
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return schemas.ReminderOut.model_validate(crud.update_reminder(db, reminder, payload))


@router.post("/users/{user_id}/reset-password", response_model=schemas.UserOut)
def reset_password(
    user_id: int,
    payload: schemas.PasswordSet,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updated = crud.update_user_password(db, user, hash_password(payload.new_password))
    html = (
        "<html><body style='font-family:sans-serif'>"
        "<p>Un administrador restableció la contraseña de tu cuenta del panel del mecánico.</p>"
        "<p style='color:#64748b'>An admin reset your mechanic panel password.</p>"
        "</body></html>"
    )
    send_account_email(db, user.email, "Contraseña restablecida / Password reset", html)
    return schemas.UserOut.model_validate(updated)


# --------------------------------------------------------------------------
# Gmail integration
# --------------------------------------------------------------------------
@router.get("/gmail/settings", response_model=schemas.GmailSettingsOut)
def gmail_settings(user: User = Depends(require_mechanic), db: Session = Depends(get_db)):
    s = crud.get_gmail_settings(db)
    return schemas.GmailSettingsOut(
        configured=bool(s.client_id and s.client_secret and s.from_email),
        activated=s.activated,
        from_email=s.from_email,
        updated_at=s.updated_at,
    )


@router.put("/gmail/settings", response_model=schemas.GmailSettingsOut)
def update_gmail_settings(
    payload: schemas.GmailSettingsUpdate,
    user: User = Depends(require_mechanic),
    db: Session = Depends(get_db),
):
    crud.save_gmail_settings(db, payload.client_id, payload.client_secret, payload.from_email)
    return schemas.GmailSettingsOut(
        configured=True,
        activated=crud.get_gmail_settings(db).activated,
        from_email=payload.from_email.strip().lower(),
        updated_at=crud.get_gmail_settings(db).updated_at,
    )


@router.get("/gmail/auth-url", response_model=schemas.GmailAuthUrlOut)
def gmail_auth_url(user: User = Depends(require_mechanic), db: Session = Depends(get_db)):
    s = crud.get_gmail_settings(db)
    if not s.client_id:
        raise HTTPException(status_code=400, detail="Save your credentials first")
    import secrets

    state = secrets.token_urlsafe(32)
    crud.set_gmail_state(db, state)
    url = _gmail_authorize_url(s.client_id, gmail_redirect_uri(), state)
    return schemas.GmailAuthUrlOut(url=url, state=state)


@router.get("/gmail/callback")
def gmail_callback(code: Optional[str] = None, state: Optional[str] = None, error: Optional[str] = None, db: Session = Depends(get_db)):
    s = crud.get_gmail_settings(db)
    dashboard = settings.SITE_URL.rstrip("/") + "/mechanic/dashboard.html"
    if error:
        crud.clear_gmail_integration(db)
        return RedirectResponse(dashboard + "?gmail=error")
    if not code or not state:
        return RedirectResponse(dashboard + "?gmail=error")
    if not s.state or state != s.state:
        return RedirectResponse(dashboard + "?gmail=invalid_state")
    if s.state_expires is None or s.state_expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        crud.clear_gmail_integration(db)
        return RedirectResponse(dashboard + "?gmail=expired")
    try:
        tokens = exchange_code_for_tokens(s.client_id, s.client_secret, code)
        crud.save_gmail_tokens(db, tokens["refresh_token"])
    except GmailSendError:
        return RedirectResponse(dashboard + "?gmail=error")
    return RedirectResponse(dashboard + "?gmail=activated")


@router.post("/gmail/test")
def gmail_test(user: User = Depends(require_mechanic), db: Session = Depends(get_db)):
    s = crud.get_gmail_settings(db)
    if not s.activated:
        raise HTTPException(status_code=400, detail="Gmail is not activated")
    try:
        send_html_email(
            db,
            s.from_email,
            "Prueba de Gmail / Gmail test",
            "<html><body><p>Tu integración de Gmail funciona correctamente.</p>"
            "<p style='color:#64748b'>Your Gmail integration is working.</p></body></html>",
        )
    except GmailSendError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.post("/gmail/deactivate")
def gmail_deactivate(user: User = Depends(require_mechanic), db: Session = Depends(get_db)):
    crud.clear_gmail_integration(db)
    return {"ok": True}


# --------------------------------------------------------------------------
# WhatsApp integration (Kapso)
# --------------------------------------------------------------------------
@router.get("/whatsapp/settings", response_model=schemas.WhatsAppSettingsOut)
def whatsapp_settings(user: User = Depends(require_mechanic), db: Session = Depends(get_db)):
    s = crud.get_whatsapp_settings(db)
    return schemas.WhatsAppSettingsOut(
        configured=bool(s.api_key and s.phone_number_id),
        activated=s.activated,
        phone_number_id=s.phone_number_id,
        test_phone=s.test_phone,
        updated_at=s.updated_at,
    )


@router.put("/whatsapp/settings", response_model=schemas.WhatsAppSettingsOut)
def update_whatsapp_settings(
    payload: schemas.WhatsAppSettingsUpdate,
    user: User = Depends(require_mechanic),
    db: Session = Depends(get_db),
):
    crud.save_whatsapp_settings(
        db, payload.api_key, payload.phone_number_id, payload.test_phone
    )
    s = crud.get_whatsapp_settings(db)
    return schemas.WhatsAppSettingsOut(
        configured=s.activated,
        activated=s.activated,
        phone_number_id=s.phone_number_id,
        test_phone=s.test_phone,
        updated_at=s.updated_at,
    )


@router.post("/whatsapp/test")
def whatsapp_test(user: User = Depends(require_mechanic), db: Session = Depends(get_db)):
    from ..whatsapp_sender import WhatsAppSendError, normalize_phone, send_whatsapp_message

    s = crud.get_whatsapp_settings(db)
    if not s.activated:
        raise HTTPException(status_code=400, detail="WhatsApp is not activated")
    if not s.test_phone:
        raise HTTPException(
            status_code=400, detail="Set a test phone number first"
        )
    try:
        send_whatsapp_message(
            db,
            normalize_phone("", s.test_phone),
            "Prueba de WhatsApp / WhatsApp test - Tu integracion funciona correctamente.",
        )
    except WhatsAppSendError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


@router.post("/whatsapp/deactivate")
def whatsapp_deactivate(user: User = Depends(require_mechanic), db: Session = Depends(get_db)):
    crud.clear_whatsapp_integration(db)
    return {"ok": True}


# --------------------------------------------------------------------------
# Registered clients & emails
# --------------------------------------------------------------------------
@router.get("/clients", response_model=list[schemas.ClientOut])
def list_clients(user: User = Depends(require_mechanic), db: Session = Depends(get_db)):
    return [schemas.ClientOut.model_validate(c) for c in crud.list_clients(db)]


@router.get(
    "/clients/{client_id}/vehicles",
    response_model=list[schemas.VehicleSummaryOut],
    dependencies=[Depends(rate_limit(max_requests=60, window_seconds=60))],
)
def list_client_vehicles(
    client_id: int, user: User = Depends(require_mechanic), db: Session = Depends(get_db)
):
    vehicles = crud.list_vehicles_by_client(db, client_id)
    counts = crud.count_vehicle_service_records(db, [v.id for v in vehicles])
    owners = crud.list_vehicle_owners(db, [v.id for v in vehicles])
    out = []
    for v in vehicles:
        s = schemas.VehicleSummaryOut.model_validate(v)
        s.services_count = counts.get(v.id, 0)
        s.owners = [schemas.ClientBrief.model_validate(c) for c in owners.get(v.id, [])]
        out.append(s)
    return out


@router.delete(
    "/clients/{client_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(rate_limit(max_requests=30, window_seconds=60))],
)
def delete_client(
    client_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    try:
        crud.delete_client(db, client_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return None


@router.post(
    "/emails/send",
    dependencies=[Depends(rate_limit(max_requests=30, window_seconds=60))],
)
def send_email(
    payload: schemas.EmailSend,
    user: User = Depends(require_mechanic),
    db: Session = Depends(get_db),
):
    html = payload.body.replace("\n", "<br/>")
    try:
        send_html_email(db, payload.to_email, payload.subject, f"<html><body>{html}</body></html>")
    except GmailSendError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True}


# --------------------------------------------------------------------------
# Appointments
# --------------------------------------------------------------------------
@router.get("/appointments", response_model=list[schemas.AppointmentOut],
            dependencies=[Depends(require_mechanic)])
def list_appointments(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    date_from: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    if status_filter and status_filter not in schemas.VALID_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"status must be one of {sorted(schemas.VALID_STATUSES)}",
        )
    appts = crud.list_appointments(db, status=status_filter, date_from=date_from)
    plate_keys = [schemas.normalize_plate_key(a.plate) for a in appts]
    by_key = crud.map_vehicle_ids_by_plate(db, plate_keys)
    out = []
    for a in appts:
        s = schemas.AppointmentOut.model_validate(a)
        s.vehicle_id = by_key.get(schemas.normalize_plate_key(a.plate))
        out.append(s)
    return out


@router.post(
    "/appointments",
    response_model=schemas.AppointmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_mechanic)],
)
def create_appointment(
    payload: schemas.AppointmentCreate, db: Session = Depends(get_db)
):
    try:
        obj = crud.create_appointment(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    from ..email_sender import send_new_appointment_email

    send_new_appointment_email(
        db=db,
        appointment_number=obj.appointment_number,
        first_name=obj.first_name,
        last_name=obj.last_name,
        phone=obj.phone,
        plate=obj.plate,
        appointment_date=obj.appointment_date,
        appointment_time=obj.appointment_time,
        address=obj.address,
        client_email=obj.email,
    )
    from ..whatsapp_sender import send_appointment_created_message

    send_appointment_created_message(
        db=db,
        appointment_number=obj.appointment_number,
        first_name=obj.first_name,
        last_name=obj.last_name,
        phone=obj.phone,
        country_code=obj.country_code,
        plate=obj.plate,
        appointment_date=obj.appointment_date,
        appointment_time=obj.appointment_time,
        address=obj.address,
    )
    event_manager.publish("appointment", {"type": "created", "number": obj.appointment_number})
    return obj


@router.patch(
    "/appointments/{number}", response_model=schemas.AppointmentOut,
    dependencies=[Depends(require_mechanic)],
)
def update_status(
    number: str,
    payload: schemas.AppointmentUpdateStatus,
    db: Session = Depends(get_db),
):
    obj = crud.get_by_number(db, number)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    was_confirmed = obj.status == "confirmed"
    result = crud.update_status(db, obj, payload.status)
    if payload.status == "confirmed" and not was_confirmed:
        from ..whatsapp_sender import send_appointment_confirmed_message

        send_appointment_confirmed_message(
            db=db,
            appointment_number=obj.appointment_number,
            first_name=obj.first_name,
            last_name=obj.last_name,
            phone=obj.phone,
            country_code=obj.country_code,
            plate=obj.plate,
            appointment_date=obj.appointment_date,
            appointment_time=obj.appointment_time,
            address=obj.address,
        )
    event_manager.publish("appointment", {"type": "updated", "number": number, "status": payload.status})
    return result


@router.put(
    "/appointments/{number}/reservation", response_model=schemas.AppointmentOut,
    dependencies=[Depends(require_mechanic)],
)
def update_reservation(
    number: str,
    payload: schemas.AppointmentReservationUpdate,
    db: Session = Depends(get_db),
):
    obj = crud.get_by_number(db, number)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    result = crud.update_reserved_dates(db, obj, payload.reserved_dates)
    event_manager.publish("appointment", {"type": "updated", "number": number})
    return result


@router.delete(
    "/appointments/{number}", status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_mechanic)],
)
def delete_appointment(number: str, db: Session = Depends(get_db)):
    obj = crud.get_by_number(db, number)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )
    crud.delete_appointment(db, obj)
    event_manager.publish("appointment", {"type": "deleted", "number": number})
    return None


@router.get("/announcements", response_model=list[schemas.AnnouncementOut],
            dependencies=[Depends(require_mechanic)])
def list_announcements(db: Session = Depends(get_db)):
    return crud.list_announcements(db)


@router.post("/announcements", response_model=schemas.AnnouncementOut,
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_mechanic)])
def create_announcement(
    payload: schemas.AnnouncementCreate, db: Session = Depends(get_db)
):
    obj = crud.create_announcement(db, payload)
    event_manager.publish("announcement", {"type": "created"})
    return obj


@router.put("/announcements/{ann_id}", response_model=schemas.AnnouncementOut,
            dependencies=[Depends(require_mechanic)])
def update_announcement(
    ann_id: int,
    payload: schemas.AnnouncementUpdate,
    db: Session = Depends(get_db),
):
    obj = crud.get_announcement_by_id(db, ann_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Announcement not found")
    result = crud.update_announcement(db, obj, payload)
    event_manager.publish("announcement", {"type": "updated"})
    return result


@router.delete("/announcements/{ann_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_mechanic)])
def delete_announcement(ann_id: int, db: Session = Depends(get_db)):
    obj = crud.get_announcement_by_id(db, ann_id)
    if not obj:
        raise HTTPException(status_code=404, detail="Announcement not found")
    crud.delete_announcement(db, obj)
    event_manager.publish("announcement", {"type": "deleted"})
    return None


@router.get("/calendar", dependencies=[Depends(require_mechanic)])
def get_calendar(
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    return crud.get_calendar_dates(db, year, month)


@router.get("/schedule", dependencies=[Depends(require_mechanic)])
def get_mechanic_schedule(db: Session = Depends(get_db)):
    s = crud.get_work_schedule(db)
    return {"days": s.days, "updated_at": s.updated_at}


@router.put("/schedule", dependencies=[Depends(require_mechanic)])
def update_mechanic_schedule(
    payload: schemas.WorkScheduleUpdate, db: Session = Depends(get_db)
):
    obj = crud.update_work_schedule(db, payload)
    event_manager.publish("settings", {"type": "updated"})
    return {"days": obj.days, "updated_at": obj.updated_at}


@router.get("/days-off", response_model=list[schemas.DayOffOut],
            dependencies=[Depends(require_mechanic)])
def list_days_off(db: Session = Depends(get_db)):
    return crud.list_days_off(db)


@router.post("/days-off", response_model=schemas.DayOffOut,
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_mechanic)])
def create_day_off(payload: schemas.DayOffCreate, db: Session = Depends(get_db)):
    try:
        obj = crud.add_day_off(db, payload.day_off, payload.reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    event_manager.publish("settings", {"type": "updated"})
    return obj


@router.delete("/days-off/{day_off}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_mechanic)])
def delete_day_off(day_off: date, db: Session = Depends(get_db)):
    removed = crud.remove_day_off(db, day_off)
    if not removed:
        raise HTTPException(status_code=404, detail="Day off not found")
    event_manager.publish("settings", {"type": "updated"})
    return None


@router.get("/appointment-time", dependencies=[Depends(require_mechanic)])
def get_appointment_time(db: Session = Depends(get_db)):
    obj = crud.get_appointment_time_settings(db)
    return {"unit": obj.unit, "value": obj.value, "updated_at": obj.updated_at}


@router.get("/settings/site", response_model=schemas.SiteSettingsOut,
            dependencies=[Depends(require_mechanic)])
def get_site_settings_mech(db: Session = Depends(get_db)):
    obj = crud.get_site_settings(db)
    return schemas.SiteSettingsOut(logo_data_url=obj.logo_data_url)


@router.put("/settings/site", response_model=schemas.SiteSettingsOut,
            dependencies=[Depends(require_mechanic)])
def update_site_settings_mech(
    payload: schemas.SiteSettingsUpdate, db: Session = Depends(get_db)
):
    obj = crud.update_site_settings(db, payload.logo_data_url or "")
    event_manager.publish("settings", {"type": "updated"})
    return schemas.SiteSettingsOut(logo_data_url=obj.logo_data_url)


@router.put("/appointment-time", dependencies=[Depends(require_mechanic)])
def update_appointment_time(
    payload: schemas.AppointmentTimeSettingsUpdate, db: Session = Depends(get_db)
):
    obj = crud.update_appointment_time_settings(db, payload)
    event_manager.publish("settings", {"type": "updated"})
    return {"unit": obj.unit, "value": obj.value, "updated_at": obj.updated_at}


# --------------------------------------------------------------------------
# Vehicle history
# --------------------------------------------------------------------------
@router.get("/vehicles", response_model=list[schemas.VehicleSummaryOut],
            dependencies=[Depends(require_mechanic)])
def list_vehicles(
    q: str = Query(default="", max_length=60),
    db: Session = Depends(get_db),
):
    objs = crud.list_vehicles(db, q)
    counts = crud.count_vehicle_service_records(db, [o.id for o in objs])
    owners = crud.list_vehicle_owners(db, [o.id for o in objs])
    out = []
    for o in objs:
        s = schemas.VehicleSummaryOut.model_validate(o)
        s.services_count = counts.get(o.id, 0)
        s.owners = [schemas.ClientBrief.model_validate(c) for c in owners.get(o.id, [])]
        out.append(s)
    return out


@router.post("/vehicles", response_model=schemas.VehicleOut,
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_mechanic)])
def create_vehicle(payload: schemas.VehicleBase, db: Session = Depends(get_db)):
    try:
        obj = crud.create_vehicle(db, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    event_manager.publish("vehicle", {"type": "updated"})
    return obj


@router.get("/vehicles/{vehicle_id}", response_model=schemas.VehicleOut,
            dependencies=[Depends(require_mechanic)])
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    obj = crud.get_vehicle(db, vehicle_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    owners = crud.list_vehicle_owners(db, [obj.id]).get(obj.id, [])
    out = schemas.VehicleOut.model_validate(obj)
    out.owners = [schemas.ClientBrief.model_validate(c) for c in owners]
    out.service_history = [
        _service_record_out(r)
        for r in crud.list_service_records_for_vehicles(db, [obj.id])
    ]
    return out


@router.put("/vehicles/{vehicle_id}", response_model=schemas.VehicleOut,
            dependencies=[Depends(require_mechanic)])
def update_vehicle(
    vehicle_id: int, payload: schemas.VehicleUpdate, db: Session = Depends(get_db)
):
    try:
        obj = crud.update_vehicle(db, vehicle_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    event_manager.publish("vehicle", {"type": "updated"})
    return obj


@router.delete("/vehicles/{vehicle_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_mechanic)])
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    try:
        crud.delete_vehicle(db, vehicle_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    event_manager.publish("vehicle", {"type": "updated"})
    return None


@router.get("/vehicles/{vehicle_id}/history", response_model=list[schemas.ServiceRecordOut],
            dependencies=[Depends(require_mechanic)])
def list_vehicle_history(vehicle_id: int, db: Session = Depends(get_db)):
    if crud.get_vehicle(db, vehicle_id) is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return [
        _service_record_out(r)
        for r in crud.list_service_records_for_vehicles(db, [vehicle_id])
    ]


@router.post("/vehicles/{vehicle_id}/history", response_model=schemas.ServiceRecordOut,
             status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(require_mechanic)])
def create_service_record(
    vehicle_id: int, payload: schemas.ServiceRecordCreate, db: Session = Depends(get_db)
):
    try:
        obj = crud.create_service_record(db, vehicle_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404 if "vehicle" in str(e) else 400, detail=str(e))
    event_manager.publish("vehicle", {"type": "updated"})
    return _service_record_out(obj)


@router.get("/history/{record_id}", response_model=schemas.ServiceRecordOut,
            dependencies=[Depends(require_mechanic)])
def get_service_record(record_id: int, db: Session = Depends(get_db)):
    obj = crud.get_service_record(db, record_id)
    if obj is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return _service_record_out(obj)


@router.put("/history/{record_id}", response_model=schemas.ServiceRecordOut,
            dependencies=[Depends(require_mechanic)])
def update_service_record(
    record_id: int, payload: schemas.ServiceRecordUpdate, db: Session = Depends(get_db)
):
    try:
        obj = crud.update_service_record(db, record_id, payload)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    event_manager.publish("vehicle", {"type": "updated"})
    return _service_record_out(obj)


@router.delete("/history/{record_id}", status_code=status.HTTP_204_NO_CONTENT,
               dependencies=[Depends(require_mechanic)])
def delete_service_record(record_id: int, db: Session = Depends(get_db)):
    try:
        crud.delete_service_record(db, record_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    event_manager.publish("vehicle", {"type": "updated"})
    return None


def _service_record_out(record) -> schemas.ServiceRecordOut:
    out = schemas.ServiceRecordOut.model_validate(record)
    total = 0.0
    for row in record.price_rows:
        if row.amount is not None:
            total += float(row.amount)
    out.total = round(total, 2)
    return out
