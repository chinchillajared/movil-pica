import json

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import settings
from .crud import DEFAULT_WORK_SCHEDULE
from .database import Base, engine
from .routers import events, i18n_router, mechanic, public
from .routers.client_auth import router as client_auth_router

app = FastAPI(
    title="Mobile Mechanic Appointments",
    version="1.1.0",
    description="Appointment scheduling service for a mobile mechanic.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError) -> JSONResponse:
    messages = []
    for err in exc.errors():
        msg = err.get("msg", "")
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, "):]
        messages.append(msg)
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages) or "Invalid request"})


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    with engine.connect() as conn:
        conn.execute(
            text(
                "ALTER TABLE appointments "
                "ADD COLUMN IF NOT EXISTS plate VARCHAR(20) NOT NULL DEFAULT ''"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE appointments "
                "ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) NOT NULL DEFAULT '+506'"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE appointments "
                "ADD COLUMN IF NOT EXISTS email VARCHAR(255)"
            )
        )
        conn.execute(
            text(
                "UPDATE appointments SET country_code = '+506', phone = SUBSTRING(phone, 5) "
                "WHERE phone LIKE '+506%' AND country_code = '+506'"
            )
        )
        conn.execute(
            text(
                "UPDATE appointments SET country_code = '+1', phone = SUBSTRING(phone, 3) "
                "WHERE phone LIKE '+1%' AND country_code = '+506'"
            )
        )
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS announcements ("
                "id SERIAL PRIMARY KEY, "
                "text TEXT NOT NULL, "
                "bg_color VARCHAR(7) NOT NULL DEFAULT '#1d4ed8', "
                "duration_hours INTEGER NOT NULL DEFAULT 24, "
                "is_active BOOLEAN NOT NULL DEFAULT TRUE, "
                "created_at TIMESTAMPTZ DEFAULT NOW(), "
                "updated_at TIMESTAMPTZ DEFAULT NOW()"
                ")"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE announcements "
                "ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN NOT NULL DEFAULT FALSE"
            )
        )
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS work_schedule ("
                "id INTEGER PRIMARY KEY, "
                "days JSON NOT NULL DEFAULT '[]', "
                "updated_at TIMESTAMPTZ DEFAULT NOW()"
                ")"
            )
        )
        has_legacy_schedule = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'work_schedule' AND column_name = 'start_time'"
            )
        ).scalar_one_or_none()
        if has_legacy_schedule:
            conn.execute(
                text(
                    "UPDATE work_schedule "
                    "SET days = ("
                    "  SELECT COALESCE(json_agg(json_build_object("
                    "    'day', value::text::int, "
                    "    'start_time', to_char(start_time, 'HH24:MI'), "
                    "    'end_time', to_char(end_time, 'HH24:MI')"
                    "  )), '[]'::json) "
                    "  FROM json_array_elements(days::json) AS t(value) "
                    ") "
                    "WHERE id = 1 "
                    "  AND json_typeof(days) = 'array' "
                    "  AND (SELECT count(*) FROM json_array_elements(days::json) "
                    "       WHERE json_typeof(value) = 'number') > 0"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE work_schedule "
                    "DROP COLUMN IF EXISTS start_time, "
                    "DROP COLUMN IF EXISTS end_time"
                )
            )
        conn.execute(
            text(
                "INSERT INTO work_schedule (id, days) "
                "VALUES (:id, :days) "
                "ON CONFLICT (id) DO NOTHING"
            ),
            {"id": 1, "days": json.dumps(DEFAULT_WORK_SCHEDULE)},
        )
        conn.execute(
            text(
                "ALTER TABLE vehicles "
                "ADD COLUMN IF NOT EXISTS front_photo TEXT NOT NULL DEFAULT ''"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE vehicles "
                "DROP COLUMN IF EXISTS vin, "
                "DROP COLUMN IF EXISTS mileage, "
                "DROP COLUMN IF EXISTS fuel_level, "
                "DROP COLUMN IF EXISTS condition_notes, "
                "DROP COLUMN IF EXISTS photos, "
                "DROP COLUMN IF EXISTS defects"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE vehicle_visits "
                "ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '', "
                "ADD COLUMN IF NOT EXISTS mileage_photo TEXT NOT NULL DEFAULT '', "
                "ADD COLUMN IF NOT EXISTS fuel_level_photo TEXT NOT NULL DEFAULT '', "
                "ADD COLUMN IF NOT EXISTS condition_photos JSON NOT NULL DEFAULT '{}', "
                "ADD COLUMN IF NOT EXISTS defect_photos JSON NOT NULL DEFAULT '[]', "
                "ADD COLUMN IF NOT EXISTS observations TEXT NOT NULL DEFAULT '', "
                "ADD COLUMN IF NOT EXISTS belongings TEXT NOT NULL DEFAULT '', "
                "ADD COLUMN IF NOT EXISTS belongings_photos JSON NOT NULL DEFAULT '[]', "
                "ADD COLUMN IF NOT EXISTS jobs JSON NOT NULL DEFAULT '[]'"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE vehicle_visits "
                "DROP COLUMN IF EXISTS mileage, "
                "DROP COLUMN IF EXISTS photos, "
                "DROP COLUMN IF EXISTS defects, "
                "DROP COLUMN IF EXISTS client_report, "
                "DROP COLUMN IF EXISTS diagnostic, "
                "DROP COLUMN IF EXISTS work_done, "
                "DROP COLUMN IF EXISTS parts, "
                "DROP COLUMN IF EXISTS cost"
            )
        )
        conn.commit()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(public.router)
app.include_router(mechanic.router)
app.include_router(client_auth_router)
app.include_router(events.router)
app.include_router(i18n_router.router)
