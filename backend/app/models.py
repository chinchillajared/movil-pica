from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    Time,
    DateTime,
    Text,
    Boolean,
    CheckConstraint,
    JSON,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','confirmed','completed','cancelled')",
            name="appointments_status_check",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    appointment_number = Column(String(20), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(30), nullable=False)
    country_code = Column(String(10), nullable=False, server_default="+506")
    email = Column(String(255), nullable=True)
    appointment_date = Column(Date, nullable=False)
    appointment_time = Column(Time, nullable=False)
    plate = Column(String(20), nullable=False, server_default="")
    address = Column(Text, nullable=False)
    # reserved_dates: extra specific days (ISO "YYYY-MM-DD") reserved for this
    # appointment beyond the appointment_date (blocked on the client calendar).
    reserved_dates = Column(JSON, nullable=False, default=list)
    status = Column(String(20), nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    bg_color = Column(String(7), nullable=False, default="#1d4ed8")
    duration_hours = Column(Integer, nullable=False, default=24)
    is_permanent = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class WorkSchedule(Base):
    __tablename__ = "work_schedule"

    id = Column(Integer, primary_key=True, index=True)
    # Days of the week (JS convention: 0=Sunday .. 6=Saturday).
    # Each entry: {"day": 0..6, "start_time": "HH:MM", "end_time": "HH:MM"}
    days = Column(JSON, nullable=False, default=list)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class DayOff(Base):
    __tablename__ = "days_off"

    id = Column(Integer, primary_key=True, index=True)
    day_off = Column(Date, nullable=False, unique=True, index=True)
    reason = Column(String(200), nullable=False, server_default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class AppointmentTimeSettings(Base):
    __tablename__ = "appointment_time_settings"

    id = Column(Integer, primary_key=True, index=True)
    # unit: "hours" or "days" — how each appointment blocks availability
    unit = Column(String(10), nullable=False, default="hours")
    # value: number of hours or days reserved per appointment
    value = Column(Integer, nullable=False, default=2)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class Client(Base):
    """Registered clients (public site accounts)."""

    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    phone = Column(String(30), nullable=False, server_default="")
    country_code = Column(String(10), nullable=False, server_default="+506")
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    vehicles = relationship(
        "Vehicle",
        secondary="client_vehicles",
        back_populates="client_owners",
        passive_deletes=True,
    )


class ClientVehicle(Base):
    """Many-to-many link between clients and vehicles."""

    __tablename__ = "client_vehicles"
    __table_args__ = (
        UniqueConstraint("client_id", "vehicle_id", name="uq_client_vehicle"),
    )

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(
        Integer, ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    vehicle_id = Column(
        Integer,
        ForeignKey("vehicles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    """Mechanic panel accounts (roles: admin / mechanic)."""

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "role IN ('admin','mechanic')",
            name="users_role_check",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, server_default="")
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="mechanic")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class GmailSettings(Base):
    """Singleton (id=1) Gmail OAuth integration settings."""

    __tablename__ = "gmail_settings"

    id = Column(Integer, primary_key=True)
    client_id = Column(String(255), nullable=False, server_default="")
    client_secret = Column(String(255), nullable=False, server_default="")
    from_email = Column(String(255), nullable=False, server_default="")
    refresh_token = Column(String(512), nullable=False, server_default="")
    activated = Column(Boolean, nullable=False, default=False)
    state = Column(String(128), nullable=False, server_default="")
    state_expires = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class SiteSettings(Base):
    """Singleton (id=1) site-wide settings (e.g. uploaded logo)."""

    __tablename__ = "site_settings"

    id = Column(Integer, primary_key=True)
    # logo_data_url: "<data-url base64>" uploaded by the admin (empty = none)
    logo_data_url = Column(Text, nullable=False, server_default="")
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )


class Vehicle(Base):
    """Vehicle card (Historial de Vehículos), identified by canonical plate."""

    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    plate = Column(String(20), nullable=False, index=True)
    # plate_key: canonical normalized plate (uppercase, no spaces/dashes) unique
    plate_key = Column(String(20), nullable=False, unique=True, index=True, server_default="")
    make = Column(String(80), nullable=False, server_default="")
    model = Column(String(80), nullable=False, server_default="")
    year = Column(Integer, nullable=True)
    color = Column(String(40), nullable=False, server_default="")
    # front_photo: single "<data-url base64>" for the front of the vehicle
    front_photo = Column(Text, nullable=False, server_default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    visits = relationship(
        "VehicleVisit",
        back_populates="vehicle",
        cascade="all, delete-orphan",
        order_by="VehicleVisit.visit_date.desc(), VehicleVisit.id.desc()",
    )

    client_owners = relationship(
        "Client",
        secondary="client_vehicles",
        back_populates="vehicles",
        passive_deletes=True,
    )


class VehicleVisit(Base):
    """A diagnostic / work record on a vehicle."""

    __tablename__ = "vehicle_visits"

    id = Column(Integer, primary_key=True, index=True)
    vehicle_id = Column(
        Integer, ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    visit_date = Column(Date, nullable=False)
    # title: short title of the record (e.g. "Problema de arranque")
    title = Column(Text, nullable=False, server_default="")
    # mileage_photo: "<data-url base64>" of the odometer
    mileage_photo = Column(Text, nullable=False, server_default="")
    # fuel_level_photo: "<data-url base64>" of the fuel gauge
    fuel_level_photo = Column(Text, nullable=False, server_default="")
    # condition_photos: {"front": url, "left": url, "right": url, "rear": url}
    condition_photos = Column(JSON, nullable=False, default=dict)
    # defect_photos: list of "<data-url base64>" strings
    defect_photos = Column(JSON, nullable=False, default=list)
    observations = Column(Text, nullable=False, server_default="")
    # belongings: text of personal items left in the vehicle
    belongings = Column(Text, nullable=False, server_default="")
    # belongings_photos: list of "<data-url base64>" strings
    belongings_photos = Column(JSON, nullable=False, default=list)
    # jobs: [{"diagnostic": str, "observations": str, "photos": [url, ...]}]
    jobs = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    vehicle = relationship("Vehicle", back_populates="visits")
