from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from sqlalchemy import select, desc, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models, schemas


class DuplicateVisitTitleError(ValueError):
    pass


def _generate_number(db: Session, for_date: date) -> str:
    today_prefix = f"APT-{for_date.strftime('%Y%m%d')}-"
    like_pat = f"{today_prefix}%"
    stmt = (
        select(models.Appointment.appointment_number)
        .where(models.Appointment.appointment_number.like(like_pat))
        .order_by(models.Appointment.id.desc())
        .limit(1)
    )
    last = db.execute(stmt).scalar_one_or_none()
    next_seq = 1
    if last:
        try:
            next_seq = int(last.rsplit("-", 1)[-1]) + 1
        except ValueError:
            next_seq = 1
    return f"{today_prefix}{next_seq:04d}"


def create_appointment(db: Session, data: schemas.AppointmentCreate) -> models.Appointment:
    validate_appointment_slot(db, data.appointment_date, data.appointment_time)
    appt_date = data.appointment_date
    number = _generate_number(db, appt_date)
    obj = models.Appointment(
        appointment_number=number,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        country_code=data.country_code,
        email=data.email,
        plate=data.plate,
        appointment_date=appt_date,
        appointment_time=data.appointment_time,
        address=data.address,
        status="pending",
    )
    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    db.refresh(obj)
    return obj


def get_by_number(db: Session, number: str) -> Optional[models.Appointment]:
    stmt = select(models.Appointment).where(
        models.Appointment.appointment_number == number
    )
    return db.execute(stmt).scalar_one_or_none()


def list_appointments(
    db: Session, status: Optional[str] = None, date_from: Optional[date] = None
):
    stmt = select(models.Appointment).order_by(
        models.Appointment.appointment_date.asc(),
        models.Appointment.appointment_time.asc(),
    )
    if status:
        stmt = stmt.where(models.Appointment.status == status)
    if date_from:
        stmt = stmt.where(models.Appointment.appointment_date >= date_from)
    return db.execute(stmt).scalars().all()


def update_status(
    db: Session, obj: models.Appointment, new_status: str
) -> models.Appointment:
    obj.status = new_status
    db.commit()
    db.refresh(obj)
    return obj


def update_reserved_dates(
    db: Session, obj: models.Appointment, reserved_dates: list[str]
) -> models.Appointment:
    obj.reserved_dates = list(dict.fromkeys(reserved_dates or []))
    db.commit()
    db.refresh(obj)
    return obj


def delete_appointment(db: Session, obj: models.Appointment) -> None:
    db.delete(obj)
    db.commit()


def get_taken_dates(
    db: Session,
    from_date: date,
    to_date: date,
    exclude_dates: Optional[list[date]] = None,
) -> list[date]:
    settings = get_appointment_time_settings(db)
    exclude = set(exclude_dates or [])
    query_from = from_date - timedelta(days=1)
    query_to = to_date + timedelta(days=1)
    stmt = (
        select(models.Appointment.appointment_date, models.Appointment.reserved_dates)
        .where(
            models.Appointment.appointment_date >= query_from,
            models.Appointment.appointment_date <= query_to,
            models.Appointment.status.notin_(["cancelled", "completed"]),
        )
    )
    rows = db.execute(stmt).all()
    appt_dates = set(d for d, _ in rows)
    blocked = set()
    if settings.unit == "days":
        for d in appt_dates:
            for i in range(settings.value):
                blocked.add(d + timedelta(days=i))
    # In "hours" mode, appointment days stay available (only hours are blocked).
    for _, reserved in rows:
        for extra in reserved or []:
            try:
                blocked.add(date.fromisoformat(str(extra)))
            except ValueError:
                continue
    for d in list_days_off(db):
        blocked.add(d.day_off)
    return sorted([d for d in blocked if from_date <= d <= to_date and d not in exclude])


def get_taken_times(db: Session, for_date: date) -> list[str]:
    settings = get_appointment_time_settings(db)
    stmt = (
        select(models.Appointment.appointment_time)
        .where(
            models.Appointment.appointment_date == for_date,
            models.Appointment.status.notin_(["cancelled", "completed"]),
        )
    )
    times = [row[0] for row in db.execute(stmt).all()]
    if settings.unit == "days":
        return sorted({t.strftime("%H:%M") for t in times})
    blocked = set()
    for t in times:
        for i in range(settings.value):
            h = t.hour + i
            if h < 24:
                blocked.add(f"{h:02d}:00")
    return sorted(blocked)


def get_by_phone_and_plate(
    db: Session, phone: str, plate: str
) -> Optional[models.Appointment]:
    stmt = (
        select(models.Appointment)
        .where(
            models.Appointment.phone == phone,
            models.Appointment.plate == plate,
        )
        .order_by(desc(models.Appointment.created_at))
        .limit(1)
    )
    return db.execute(stmt).scalar_one_or_none()


def create_announcement(db: Session, data: schemas.AnnouncementCreate) -> models.Announcement:
    obj = models.Announcement(
        text=data.text,
        bg_color=data.bg_color,
        duration_hours=data.duration_hours,
        is_permanent=data.is_permanent,
        is_active=True,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def update_announcement(
    db: Session, obj: models.Announcement, data: schemas.AnnouncementUpdate
) -> models.Announcement:
    if data.text is not None:
        obj.text = data.text
    if data.bg_color is not None:
        obj.bg_color = data.bg_color
    if data.duration_hours is not None:
        obj.duration_hours = data.duration_hours
    if data.is_permanent is not None:
        obj.is_permanent = data.is_permanent
    db.commit()
    db.refresh(obj)
    return obj


def get_active_announcements(db: Session) -> list[models.Announcement]:
    return (
        db.query(models.Announcement)
        .filter(models.Announcement.is_active == True)
        .order_by(models.Announcement.created_at.asc())
        .all()
    )


def list_announcements(db: Session) -> list[models.Announcement]:
    return (
        db.query(models.Announcement)
        .order_by(desc(models.Announcement.created_at))
        .all()
    )


def get_announcement_by_id(db: Session, ann_id: int) -> Optional[models.Announcement]:
    return db.query(models.Announcement).filter(models.Announcement.id == ann_id).first()


def delete_announcement(db: Session, obj: models.Announcement) -> None:
    db.delete(obj)
    db.commit()


def get_calendar_dates(
    db: Session, year: int, month: int
) -> list[dict]:
    from sqlalchemy import func as sqlfunc
    from_date = date(year, month, 1)
    next_month = month + 1 if month < 12 else 1
    next_year = year if month < 12 else year + 1
    to_date = date(next_year, next_month, 1) - timedelta(days=1)
    stmt = (
        select(
            models.Appointment.appointment_date,
            models.Appointment.status,
        )
        .where(
            models.Appointment.appointment_date >= from_date,
            models.Appointment.appointment_date <= to_date,
        )
        .order_by(models.Appointment.appointment_date)
    )
    rows = db.execute(stmt).all()
    result = {}
    for d, s in rows:
        ds = d.isoformat()
        if ds not in result:
            result[ds] = []
        if s not in result[ds]:
            result[ds].append(s)
    return [{"date": d, "statuses": s} for d, s in result.items()]


DEFAULT_WORK_SCHEDULE = [
    {"day": 1, "start_time": "08:00", "end_time": "17:00"},
    {"day": 2, "start_time": "08:00", "end_time": "17:00"},
    {"day": 3, "start_time": "08:00", "end_time": "17:00"},
    {"day": 4, "start_time": "08:00", "end_time": "17:00"},
    {"day": 5, "start_time": "08:00", "end_time": "17:00"},
    {"day": 6, "start_time": "08:00", "end_time": "17:00"},
]


def _parse_hm(value: str) -> time:
    return datetime.strptime(value, "%H:%M").time()


def get_work_schedule(db: Session) -> models.WorkSchedule:
    obj = db.get(models.WorkSchedule, 1)
    if not obj:
        obj = models.WorkSchedule(id=1, days=DEFAULT_WORK_SCHEDULE)
        db.add(obj)
        db.commit()
        db.refresh(obj)
    else:
        if not obj.days or not isinstance(obj.days, list):
            obj.days = DEFAULT_WORK_SCHEDULE
            db.commit()
            db.refresh(obj)
    return obj


def update_work_schedule(
    db: Session, data: schemas.WorkScheduleUpdate
) -> models.WorkSchedule:
    obj = get_work_schedule(db)
    obj.days = []
    for d in data.days:
        entry = {
            "day": d.day,
            "start_time": d.start_time,
            "end_time": d.end_time,
        }
        if d.lunch_start:
            entry["lunch_start"] = d.lunch_start
        if d.lunch_end:
            entry["lunch_end"] = d.lunch_end
        obj.days.append(entry)
    db.commit()
    db.refresh(obj)
    return obj


def validate_appointment_slot(
    db: Session, appt_date: date, appt_time: time
) -> None:
    if get_day_off(db, appt_date) is not None:
        raise ValueError("appointment_date is a day off")
    schedule = get_work_schedule(db)
    js_day = (appt_date.weekday() + 1) % 7
    day_entry = next((d for d in schedule.days if d["day"] == js_day), None)
    if day_entry is None:
        raise ValueError("appointment_date is not a working day")
    start = _parse_hm(day_entry["start_time"])
    end = _parse_hm(day_entry["end_time"])
    if appt_time < start or appt_time >= end:
        raise ValueError("appointment_time is outside working hours")
    if day_entry.get("lunch_start") and day_entry.get("lunch_end"):
        lunch_start = _parse_hm(day_entry["lunch_start"])
        lunch_end = _parse_hm(day_entry["lunch_end"])
        if lunch_start <= appt_time < lunch_end:
            raise ValueError("appointment_time is within lunch break")


def list_days_off(db: Session) -> list[models.DayOff]:
    stmt = select(models.DayOff).order_by(models.DayOff.day_off)
    return list(db.execute(stmt).scalars().all())


def get_day_off(db: Session, day_off: date) -> models.DayOff | None:
    return db.execute(
        select(models.DayOff).where(models.DayOff.day_off == day_off)
    ).scalar_one_or_none()


def add_day_off(
    db: Session, day_off: date, reason: str = ""
) -> models.DayOff:
    existing = get_day_off(db, day_off)
    if existing:
        raise ValueError("day_off already exists")
    obj = models.DayOff(day_off=day_off, reason=reason)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def remove_day_off(db: Session, day_off: date) -> bool:
    obj = get_day_off(db, day_off)
    if not obj:
        return False
    db.delete(obj)
    db.commit()
    return True


DEFAULT_APPOINTMENT_TIME = {"unit": "hours", "value": 2}


def get_appointment_time_settings(db: Session) -> models.AppointmentTimeSettings:
    obj = db.get(models.AppointmentTimeSettings, 1)
    if not obj:
        obj = models.AppointmentTimeSettings(
            id=1,
            unit=DEFAULT_APPOINTMENT_TIME["unit"],
            value=DEFAULT_APPOINTMENT_TIME["value"],
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
    return obj


def update_appointment_time_settings(
    db: Session, data: schemas.AppointmentTimeSettingsUpdate
) -> models.AppointmentTimeSettings:
    obj = get_appointment_time_settings(db)
    obj.unit = data.unit
    obj.value = data.value
    db.commit()
    db.refresh(obj)
    return obj


def get_site_settings(db: Session) -> models.SiteSettings:
    obj = db.get(models.SiteSettings, 1)
    if not obj:
        obj = models.SiteSettings(id=1, logo_data_url="")
        db.add(obj)
        db.commit()
        db.refresh(obj)
    return obj


def update_site_settings(
    db: Session, logo_data_url: Optional[str] = None
) -> models.SiteSettings:
    obj = get_site_settings(db)
    if logo_data_url is not None:
        obj.logo_data_url = logo_data_url
    db.commit()
    db.refresh(obj)
    return obj


# --------------------------------------------------------------------------
# Clients (public registered accounts)
# --------------------------------------------------------------------------
def get_client_by_email(db: Session, email: str) -> Optional[models.Client]:
    return db.execute(
        select(models.Client).where(models.Client.email == email.strip().lower())
    ).scalar_one_or_none()


def get_client_by_id(db: Session, client_id: int) -> Optional[models.Client]:
    return db.get(models.Client, client_id)


def list_clients(db: Session) -> list[models.Client]:
    stmt = select(models.Client).order_by(models.Client.created_at.desc())
    return list(db.execute(stmt).scalars().all())


def create_client(
    db: Session, data: schemas.ClientRegister, password_hash: str
) -> models.Client:
    obj = models.Client(
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email.strip().lower(),
        phone=data.phone,
        country_code=data.country_code,
        password_hash=password_hash,
    )
    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("email already registered")
    db.refresh(obj)
    return obj


def update_client_password(
    db: Session, client: models.Client, password_hash: str
) -> None:
    client.password_hash = password_hash
    db.commit()


# --------------------------------------------------------------------------
# Mechanic panel users
# --------------------------------------------------------------------------
def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.execute(
        select(models.User).where(models.User.email == email.strip().lower())
    ).scalar_one_or_none()


def count_users(db: Session) -> int:
    return db.execute(select(func.count(models.User.id))).scalar_one()


def get_user_by_id(db: Session, user_id: int) -> Optional[models.User]:
    return db.get(models.User, user_id)


def list_users(db: Session) -> list[models.User]:
    stmt = select(models.User).order_by(models.User.id.asc())
    return list(db.execute(stmt).scalars().all())


def create_user(
    db: Session, data: schemas.UserCreate, password_hash: str
) -> models.User:
    obj = models.User(
        name=data.name.strip(),
        email=data.email.strip().lower(),
        password_hash=password_hash,
        role=data.role,
        is_active=True,
    )
    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("email already registered")
    db.refresh(obj)
    return obj


def update_user(
    db: Session, user: models.User, data: schemas.UserUpdate
) -> models.User:
    if data.name is not None and data.name.strip():
        user.name = data.name.strip()
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return user


def update_user_password(
    db: Session, user: models.User, password_hash: str
) -> models.User:
    user.password_hash = password_hash
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user: models.User) -> None:
    db.delete(user)
    db.commit()


# --------------------------------------------------------------------------
# Gmail settings (singleton id=1)
# --------------------------------------------------------------------------
def get_gmail_settings(db: Session) -> models.GmailSettings:
    obj = db.get(models.GmailSettings, 1)
    if not obj:
        obj = models.GmailSettings(id=1)
        db.add(obj)
        db.commit()
        db.refresh(obj)
    return obj


def save_gmail_settings(
    db: Session,
    client_id: str,
    client_secret: str,
    from_email: str,
) -> models.GmailSettings:
    obj = get_gmail_settings(db)
    obj.client_id = client_id.strip()
    obj.client_secret = client_secret.strip()
    obj.from_email = from_email.strip().lower()
    db.commit()
    db.refresh(obj)
    return obj


def save_gmail_tokens(
    db: Session, refresh_token: str, from_email: str | None = None
) -> models.GmailSettings:
    obj = get_gmail_settings(db)
    obj.refresh_token = refresh_token
    if from_email:
        obj.from_email = from_email.strip().lower()
    obj.activated = True
    obj.state = ""
    obj.state_expires = None
    db.commit()
    db.refresh(obj)
    return obj


def set_gmail_state(db: Session, state: str) -> models.GmailSettings:
    obj = get_gmail_settings(db)
    obj.state = state
    obj.state_expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    db.commit()
    db.refresh(obj)
    return obj


def clear_gmail_integration(db: Session) -> models.GmailSettings:
    obj = get_gmail_settings(db)
    obj.refresh_token = ""
    obj.activated = False
    obj.state = ""
    obj.state_expires = None
    db.commit()
    db.refresh(obj)
    return obj


# --------------------------------------------------------------------------
# Vehicle history
# --------------------------------------------------------------------------
def list_vehicles(db: Session, q: str = "") -> list[models.Vehicle]:
    stmt = select(models.Vehicle)
    if q.strip():
        like = f"%{q.strip().upper()}%"
        stmt = stmt.where(
            models.Vehicle.plate.like(like)
            | models.Vehicle.plate_key.like(f"%{schemas.normalize_plate_key(q)}%")
            | models.Vehicle.make.ilike(f"%{q.strip()}%")
            | models.Vehicle.model.ilike(f"%{q.strip()}%")
        )
    stmt = stmt.order_by(models.Vehicle.plate)
    return list(db.execute(stmt).scalars().all())


def get_vehicle(db: Session, vehicle_id: int) -> models.Vehicle | None:
    return db.get(models.Vehicle, vehicle_id)


def count_vehicle_visits(
    db: Session, vehicle_ids: list[int]
) -> dict[int, int]:
    if not vehicle_ids:
        return {}
    stmt = (
        select(models.VehicleVisit.vehicle_id, func.count(models.VehicleVisit.id))
        .where(models.VehicleVisit.vehicle_id.in_(vehicle_ids))
        .group_by(models.VehicleVisit.vehicle_id)
    )
    return dict(db.execute(stmt).all())


def list_vehicle_owners(
    db: Session, vehicle_ids: list[int]
) -> dict[int, list[models.Client]]:
    if not vehicle_ids:
        return {}
    rows = db.execute(
        select(models.ClientVehicle.vehicle_id, models.Client)
        .join(models.Client, models.Client.id == models.ClientVehicle.client_id)
        .where(models.ClientVehicle.vehicle_id.in_(vehicle_ids))
        .order_by(models.Client.first_name, models.Client.last_name)
    ).all()
    out: dict[int, list[models.Client]] = {}
    for vehicle_id, client in rows:
        out.setdefault(vehicle_id, []).append(client)
    return out


def _link_client_vehicle(
    db: Session, client_id: int, vehicle_id: int
) -> None:
    exists = db.execute(
        select(models.ClientVehicle).where(
            models.ClientVehicle.client_id == client_id,
            models.ClientVehicle.vehicle_id == vehicle_id,
        )
    ).scalar_one_or_none()
    if exists is None:
        db.add(models.ClientVehicle(client_id=client_id, vehicle_id=vehicle_id))
        db.commit()


def create_vehicle(
    db: Session, data: schemas.VehicleBase, client_id: Optional[int] = None
) -> models.Vehicle:
    obj = models.Vehicle(
        plate=data.plate,
        plate_key=schemas.normalize_plate_key(data.plate),
        make=data.make.strip(),
        model=data.model.strip(),
        year=data.year,
        color=data.color.strip(),
        front_photo=data.front_photo,
    )
    db.add(obj)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("plate already registered")
    db.refresh(obj)
    if client_id is not None:
        _link_client_vehicle(db, client_id, obj.id)
        db.refresh(obj)
    return obj


def create_or_link_client_vehicle(
    db: Session, client_id: int, data: schemas.VehicleBase
) -> models.Vehicle:
    """Register a vehicle for a client: link to an existing canonical vehicle
    by normalized plate when possible, otherwise create one."""
    plate_key = schemas.normalize_plate_key(data.plate)
    existing = db.execute(
        select(models.Vehicle).where(models.Vehicle.plate_key == plate_key)
    ).scalar_one_or_none()
    if existing is None:
        return create_vehicle(db, data, client_id=client_id)
    _link_client_vehicle(db, client_id, existing.id)
    changed = False
    if data.make.strip() and not existing.make:
        existing.make = data.make.strip()
        changed = True
    if data.model.strip() and not existing.model:
        existing.model = data.model.strip()
        changed = True
    if data.year and existing.year is None:
        existing.year = data.year
        changed = True
    if data.color.strip() and not existing.color:
        existing.color = data.color.strip()
        changed = True
    if data.front_photo and not existing.front_photo:
        existing.front_photo = data.front_photo
        changed = True
    if changed:
        db.commit()
        db.refresh(existing)
    return existing


def list_vehicles_by_client(db: Session, client_id: int) -> list[models.Vehicle]:
    stmt = (
        select(models.Vehicle)
        .join(models.ClientVehicle, models.ClientVehicle.vehicle_id == models.Vehicle.id)
        .where(models.ClientVehicle.client_id == client_id)
        .order_by(models.Vehicle.plate)
    )
    return list(db.execute(stmt).scalars().all())


def unlink_client_vehicle(
    db: Session, client_id: int, vehicle_id: int
) -> None:
    link = db.execute(
        select(models.ClientVehicle).where(
            models.ClientVehicle.client_id == client_id,
            models.ClientVehicle.vehicle_id == vehicle_id,
        )
    ).scalar_one_or_none()
    if link is None:
        raise ValueError("vehicle not found")
    db.delete(link)
    db.commit()


def update_vehicle(
    db: Session, vehicle_id: int, data: schemas.VehicleUpdate
) -> models.Vehicle:
    obj = db.get(models.Vehicle, vehicle_id)
    if obj is None:
        raise ValueError("vehicle not found")
    fields = {
        "plate": "plate",
        "make": "make",
        "model": "model",
        "year": "year",
        "color": "color",
        "front_photo": "front_photo",
    }
    for attr, field in fields.items():
        val = getattr(data, field, None)
        if val is not None:
            setattr(obj, attr, val if isinstance(val, str) else val)
    obj.plate_key = schemas.normalize_plate_key(obj.plate)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValueError("plate already registered")
    db.refresh(obj)
    return obj


def delete_vehicle(db: Session, vehicle_id: int) -> None:
    obj = db.get(models.Vehicle, vehicle_id)
    if obj is None:
        raise ValueError("vehicle not found")
    db.delete(obj)
    db.commit()


def create_visit(
    db: Session, vehicle_id: int, data: schemas.VehicleVisitCreate
) -> models.VehicleVisit:
    if db.get(models.Vehicle, vehicle_id) is None:
        raise ValueError("vehicle not found")
    visit_date = data.visit_date or date.today()
    title = data.title.strip()
    title_conflict = (
        db.query(models.VehicleVisit.id)
        .filter(
            models.VehicleVisit.vehicle_id == vehicle_id,
            func.lower(models.VehicleVisit.title) == title.lower(),
        )
        .first()
    )
    if title_conflict is not None:
        raise DuplicateVisitTitleError("a visit with this title already exists")
    obj = models.VehicleVisit(
        vehicle_id=vehicle_id,
        visit_date=visit_date,
        title=title,
        mileage_photo=data.mileage_photo,
        fuel_level_photo=data.fuel_level_photo,
        condition_photos=data.condition_photos,
        defect_photos=data.defect_photos,
        observations=data.observations,
        belongings=data.belongings,
        belongings_photos=data.belongings_photos,
        jobs=[j.model_dump() for j in data.jobs],
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


def get_visit(db: Session, visit_id: int) -> models.VehicleVisit | None:
    return db.get(models.VehicleVisit, visit_id)


def update_visit(
    db: Session, visit_id: int, data: schemas.VehicleVisitUpdate
) -> models.VehicleVisit:
    obj = db.get(models.VehicleVisit, visit_id)
    if obj is None:
        raise ValueError("visit not found")
    if data.title is not None:
        new_title = data.title.strip()
        title_conflict = (
            db.query(models.VehicleVisit.id)
            .filter(
                models.VehicleVisit.vehicle_id == obj.vehicle_id,
                models.VehicleVisit.id != obj.id,
                func.lower(models.VehicleVisit.title) == new_title.lower(),
            )
            .first()
        )
        if title_conflict is not None:
            raise DuplicateVisitTitleError("a visit with this title already exists")
        obj.title = new_title
    fields = [
        "visit_date",
        "mileage_photo",
        "fuel_level_photo",
        "condition_photos",
        "defect_photos",
        "observations",
        "belongings",
        "belongings_photos",
        "jobs",
    ]
    for field in fields:
        val = getattr(data, field, None)
        if val is not None:
            if field in ("condition_photos", "defect_photos", "belongings_photos"):
                setattr(obj, field, list(val) if isinstance(val, list) else dict(val))
            elif field == "jobs":
                setattr(obj, field, [j.model_dump() for j in val])
            else:
                setattr(obj, field, val)
    db.commit()
    db.refresh(obj)
    return obj


def delete_visit(db: Session, visit_id: int) -> None:
    obj = db.get(models.VehicleVisit, visit_id)
    if obj is None:
        raise ValueError("visit not found")
    db.delete(obj)
    db.commit()
