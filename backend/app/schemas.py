import re
from datetime import date, time, datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator


VALID_STATUSES = {"pending", "confirmed", "completed", "cancelled"}

_PHONE_RE = re.compile(r"^[\d\s\-()]{4,20}$")
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PASSWORD_MIN = 8


def _validate_email(v: str) -> str:
    v = v.strip().lower()
    if not _EMAIL_RE.match(v) or len(v) > 255:
        raise ValueError("invalid email format")
    return v


class AppointmentBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=4, max_length=20)
    country_code: str = Field(default="+506", max_length=10)
    email: Optional[str] = None
    plate: str = Field(..., min_length=1, max_length=20)
    appointment_date: date
    appointment_time: time
    address: str = Field(default="", max_length=500)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        return _validate_email(v)

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_non_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be empty")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not _PHONE_RE.match(v):
            raise ValueError("invalid phone format")
        return v

    @field_validator("plate")
    @classmethod
    def normalize_plate(cls, v: str) -> str:
        v = v.strip().upper()
        if not v:
            raise ValueError("must not be empty")
        return v

    @field_validator("appointment_date")
    @classmethod
    def not_past(cls, v: date) -> date:
        if v < date.today():
            raise ValueError("appointment_date must not be in the past")
        return v

    @field_validator("appointment_time")
    @classmethod
    def reasonable_hour(cls, v: time) -> time:
        return v


class AppointmentCreate(AppointmentBase):
    pass


class AppointmentUpdateStatus(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def check_status(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in VALID_STATUSES:
            raise ValueError(f"status must be one of {sorted(VALID_STATUSES)}")
        return v


class AppointmentReservationUpdate(BaseModel):
    reserved_dates: list[str] = Field(default_factory=list)

    @field_validator("reserved_dates")
    @classmethod
    def clean_dates(cls, v: list[str]) -> list[str]:
        out = []
        seen = set()
        for item in v or []:
            item = str(item).strip()
            try:
                parsed = date.fromisoformat(item)
            except ValueError:
                raise ValueError("reserved_dates must be ISO dates (YYYY-MM-DD)")
            key = parsed.isoformat()
            if key not in seen:
                seen.add(key)
                out.append(key)
        return sorted(out)


class AppointmentOut(BaseModel):
    id: int
    appointment_number: str
    first_name: str
    last_name: str
    phone: str
    country_code: str
    email: Optional[str] = None
    plate: str
    appointment_date: date
    appointment_time: time
    address: str
    reserved_dates: list[str] = Field(default_factory=list)
    status: str
    # id of the registered vehicle matching the appointment plate, if any.
    vehicle_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AppointmentCreateResponse(BaseModel):
    appointment_number: str
    plate: str
    status: str


class AppointmentStatusView(BaseModel):
    appointment_number: str
    first_name: str
    last_name: str
    phone: str
    country_code: str
    email: Optional[str] = None
    plate: str
    appointment_date: date
    appointment_time: time
    address: str
    status: str


class AppointmentVerify(BaseModel):
    phone: str
    plate: str


class AppointmentUpdate(BaseModel):
    phone: str
    plate: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    new_phone: Optional[str] = None
    new_country_code: Optional[str] = None
    appointment_date: date
    appointment_time: time
    address: Optional[str] = None


class LoginRequest(BaseModel):
    password: str


class AnnouncementCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    bg_color: str = Field(default="#1d4ed8", max_length=7)
    duration_hours: int = Field(default=24, ge=1, le=720)
    is_permanent: bool = False


class AnnouncementUpdate(BaseModel):
    text: Optional[str] = None
    bg_color: Optional[str] = None
    duration_hours: Optional[int] = None
    is_permanent: Optional[bool] = None


class AnnouncementOut(BaseModel):
    id: int
    text: str
    bg_color: str
    duration_hours: int
    is_permanent: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReminderCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=120)

    @field_validator("text")
    @classmethod
    def strip_text(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("text must not be empty")
        return v


class ReminderUpdate(BaseModel):
    is_completed: bool


class ReminderOut(BaseModel):
    id: int
    text: str
    is_completed: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CalendarDateInfo(BaseModel):
    date: str
    statuses: list[str]


class WorkDaySchedule(BaseModel):
    day: int = Field(..., ge=0, le=6)
    start_time: str
    end_time: str
    lunch_start: Optional[str] = None
    lunch_end: Optional[str] = None

    @field_validator("start_time", "end_time", "lunch_start", "lunch_end")
    @classmethod
    def check_time(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not _TIME_RE.match(v):
            raise ValueError("time must be in HH:MM 24h format")
        return v

    @model_validator(mode="after")
    def check_order(self):
        if self.start_time >= self.end_time:
            raise ValueError("start_time must be earlier than end_time")
        if self.lunch_start and self.lunch_end and self.lunch_start >= self.lunch_end:
            raise ValueError("lunch_start must be earlier than lunch_end")
        return self


class WorkScheduleUpdate(BaseModel):
    days: list[WorkDaySchedule] = Field(..., min_length=1)

    @field_validator("days")
    @classmethod
    def check_days(cls, v: list[WorkDaySchedule]) -> list[WorkDaySchedule]:
        seen = set()
        for entry in v:
            if entry.day in seen:
                raise ValueError("duplicate day in schedule")
            seen.add(entry.day)
        return sorted(v, key=lambda entry: entry.day)


class WorkScheduleOut(BaseModel):
    days: list[WorkDaySchedule]
    updated_at: Optional[datetime] = None


class DayOffCreate(BaseModel):
    day_off: date
    reason: str = Field(default="", max_length=200)

    @field_validator("reason")
    @classmethod
    def strip_reason(cls, v: str) -> str:
        return v.strip()


class DayOffOut(BaseModel):
    id: int
    day_off: date
    reason: str
    created_at: datetime

    class Config:
        from_attributes = True


class AppointmentTimeSettingsUpdate(BaseModel):
    unit: str = "hours"
    value: int = Field(default=2, ge=1, le=72)

    @field_validator("unit")
    @classmethod
    def check_unit(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in {"hours", "days"}:
            raise ValueError("unit must be 'hours' or 'days'")
        return v


class AppointmentTimeSettingsOut(BaseModel):
    unit: str
    value: int
    updated_at: Optional[datetime] = None


# --------------------------------------------------------------------------
# Client (public site) auth
# --------------------------------------------------------------------------
class ClientRegister(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: str = Field(..., min_length=4, max_length=20)
    country_code: str = Field(default="+506", max_length=10)
    password: str = Field(..., min_length=_PASSWORD_MIN, max_length=128)

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_non_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be empty")
        return v

    @field_validator("email")
    @classmethod
    def check_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        return _validate_email(v)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not _PHONE_RE.match(v):
            raise ValueError("invalid phone format")
        return v


class ClientLogin(BaseModel):
    identifier: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=1, max_length=128)


class ClientUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, max_length=100)
    last_name: Optional[str] = Field(default=None, max_length=100)
    email: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, min_length=4, max_length=20)
    country_code: Optional[str] = Field(default=None, max_length=10)

    @field_validator("first_name", "last_name")
    @classmethod
    def strip_optional(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip()
        return v or None

    @field_validator("email")
    @classmethod
    def check_email(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        return _validate_email(v)

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not _PHONE_RE.match(v):
            raise ValueError("invalid phone format")
        return v


class ClientOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: str
    country_code: str
    created_at: datetime

    class Config:
        from_attributes = True


class ClientAuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    client: ClientOut


class ClientAppointmentOut(BaseModel):
    appointment_number: str
    first_name: str
    last_name: str
    phone: str
    plate: str
    appointment_date: date
    appointment_time: time
    address: str
    status: str

    class Config:
        from_attributes = True


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=10)


class TokenResponse(BaseModel):
    access_token: str


# --------------------------------------------------------------------------
# Mechanic panel users
# --------------------------------------------------------------------------
class UserCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str
    password: str = Field(..., min_length=_PASSWORD_MIN, max_length=128)
    role: str = "mechanic"

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return _validate_email(v)

    @field_validator("role")
    @classmethod
    def check_role(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in {"admin", "mechanic"}:
            raise ValueError("role must be 'admin' or 'mechanic'")
        return v


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("role")
    @classmethod
    def check_role(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.strip().lower()
        if v not in {"admin", "mechanic"}:
            raise ValueError("role must be 'admin' or 'mechanic'")
        return v


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TechnicianOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class MechanicLogin(BaseModel):
    email: str
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return _validate_email(v)


class MechanicAuthResponse(BaseModel):
    token: str
    refresh_token: str
    user: UserOut


class BootstrapStatus(BaseModel):
    needs_setup: bool


class AdminSetup(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str
    password: str = Field(..., min_length=_PASSWORD_MIN, max_length=128)
    logo_data_url: str = Field(default="", max_length=20000000)

    @field_validator("email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return _validate_email(v)


class SiteSettingsOut(BaseModel):
    logo_data_url: str = ""


class SiteSettingsUpdate(BaseModel):
    logo_data_url: Optional[str] = Field(default=None, max_length=20000000)


class PasswordChange(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=_PASSWORD_MIN, max_length=128)


class PasswordSet(BaseModel):
    new_password: str = Field(..., min_length=_PASSWORD_MIN, max_length=128)


# --------------------------------------------------------------------------
# Gmail integration
# --------------------------------------------------------------------------
class GmailSettingsUpdate(BaseModel):
    client_id: str = Field(..., min_length=1, max_length=255)
    client_secret: str = Field(..., min_length=1, max_length=255)
    from_email: str

    @field_validator("from_email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return _validate_email(v)


class GmailSettingsOut(BaseModel):
    configured: bool
    activated: bool
    from_email: str
    updated_at: Optional[datetime] = None


class GmailAuthUrlOut(BaseModel):
    url: str
    state: str


# --------------------------------------------------------------------------
# WhatsApp integration (Kapso)
# --------------------------------------------------------------------------
class WhatsAppSettingsUpdate(BaseModel):
    api_key: str = Field(..., min_length=1, max_length=255)
    phone_number_id: str = Field(..., min_length=1, max_length=255)
    test_phone: str = Field(default="", max_length=30)


class WhatsAppSettingsOut(BaseModel):
    configured: bool
    activated: bool
    phone_number_id: str
    test_phone: str
    updated_at: Optional[datetime] = None


class EmailSend(BaseModel):
    to_email: str
    subject: str = Field(..., min_length=1, max_length=200)
    body: str = Field(..., min_length=1, max_length=10000)

    @field_validator("to_email")
    @classmethod
    def check_email(cls, v: str) -> str:
        return _validate_email(v)


# --------------------------------------------------------------------------
# Vehicle history (Historial de Vehículos)
# --------------------------------------------------------------------------
_PLATE_RE = re.compile(r"^[A-Z0-9\-\s\.]+$")


def normalize_plate_key(v: str) -> str:
    """Canonical unique key: uppercase, non-alphanumerics removed."""
    return re.sub(r"[^A-Z0-9]", "", (v or "").strip().upper())


def _normalize_plate(v: str) -> str:
    v = v.strip().upper()
    if not v or len(v) > 20:
        raise ValueError("invalid plate")
    if not _PLATE_RE.match(v):
        raise ValueError("plate must contain only letters, numbers or dashes")
    return v


class VehicleBase(BaseModel):
    plate: str
    make: str = Field(default="", max_length=80)
    model: str = Field(default="", max_length=80)
    year: Optional[int] = Field(default=None, ge=1900, le=2200)
    color: str = Field(default="", max_length=40)
    front_photo: str = Field(default="", max_length=20000000)

    @field_validator("plate")
    @classmethod
    def check_plate(cls, v: str) -> str:
        return _normalize_plate(v)


class VehicleUpdate(BaseModel):
    plate: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    color: Optional[str] = None
    front_photo: Optional[str] = None

    @field_validator("plate")
    @classmethod
    def check_plate(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not v.strip():
            return None
        return _normalize_plate(v)


class ClientBrief(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str

    class Config:
        from_attributes = True


class VehicleSummaryOut(BaseModel):
    id: int
    plate: str
    make: str
    model: str
    year: Optional[int] = None
    color: str
    front_photo: str = ""
    owners: list[ClientBrief] = Field(default_factory=list)
    services_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class VehicleOut(BaseModel):
    id: int
    plate: str
    make: str
    model: str
    year: Optional[int] = None
    color: str
    owners: list[ClientBrief] = Field(default_factory=list)
    front_photo: str
    service_history: list["ServiceRecordOut"] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --------------------------------------------------------------------------
# Service history (Historial de Servicios)
# --------------------------------------------------------------------------
class ServicePriceRowBase(BaseModel):
    kind: str = Field(default="labor", max_length=10)
    currency: str = Field(default="CRC", max_length=5)
    description: str = Field(default="", max_length=500)
    amount: Optional[float] = Field(default=None, ge=0)

    @field_validator("kind")
    @classmethod
    def check_kind(cls, v: str) -> str:
        v = (v or "").strip().lower()
        if v not in {"labor", "parts"}:
            raise ValueError("kind must be 'labor' or 'parts'")
        return v

    @field_validator("currency")
    @classmethod
    def check_currency(cls, v: str) -> str:
        v = (v or "").strip().upper()
        if v not in {"CRC", "USD"}:
            raise ValueError("currency must be 'CRC' or 'USD'")
        return v


def _clean_mileage_unit(v: str) -> str:
    v = (v or "").strip().lower()
    if v not in {"km", "mi"}:
        raise ValueError("mileage_unit must be 'km' or 'mi'")
    return v


class ServiceRecordCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    diagnosis: str = Field(default="", max_length=5000)
    mileage: Optional[int] = Field(default=None, ge=0)
    mileage_unit: str = Field(default="km", max_length=5)
    mileage_photo: str = Field(default="", max_length=20000000)
    other_photos: list[str] = Field(default_factory=list)
    price_rows: list[ServicePriceRowBase] = Field(default_factory=list)

    @field_validator("mileage_unit")
    @classmethod
    def check_mileage_unit(cls, v: str) -> str:
        return _clean_mileage_unit(v)


class ServiceRecordUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    diagnosis: Optional[str] = Field(default=None, max_length=5000)
    mileage: Optional[int] = Field(default=None, ge=0)
    mileage_unit: Optional[str] = None
    mileage_photo: Optional[str] = None
    other_photos: Optional[list[str]] = None
    price_rows: Optional[list[ServicePriceRowBase]] = None

    @field_validator("mileage_unit")
    @classmethod
    def check_mileage_unit(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return _clean_mileage_unit(v)


class ServicePriceRowOut(BaseModel):
    id: int
    record_id: int
    kind: str
    currency: str = "CRC"
    description: str
    amount: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ServiceRecordOut(BaseModel):
    id: int
    vehicle_id: int
    title: str
    diagnosis: str
    mileage: Optional[int] = None
    mileage_unit: str = "km"
    mileage_photo: str = ""
    other_photos: list[str] = Field(default_factory=list)
    price_rows: list[ServicePriceRowOut] = Field(default_factory=list)
    total: float = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
