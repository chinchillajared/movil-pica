import json

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import settings
from .crud import DEFAULT_WORK_SCHEDULE
from .database import Base, engine
from .homepage_defaults import DEFAULT_HOMEPAGE_CONTENT, DEFAULT_HOMEPAGE_LAYOUT
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
            text("ALTER TABLE clients ALTER COLUMN email DROP NOT NULL")
        )
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
                "ALTER TABLE appointments "
                "ADD COLUMN IF NOT EXISTS reserved_dates JSON NOT NULL DEFAULT '[]'"
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
                "CREATE TABLE IF NOT EXISTS site_settings ("
                "id INTEGER PRIMARY KEY, "
                "site_name VARCHAR(200) NOT NULL DEFAULT '', "
                "site_title VARCHAR(200) NOT NULL DEFAULT 'Mecánico en Cóbano', "
                "site_tagline VARCHAR(300) NOT NULL DEFAULT 'Diagnóstico, mantenimiento y reparacion automotriz', "
                "background_images TEXT NOT NULL DEFAULT '[]', "
                "background_image_count INTEGER NOT NULL DEFAULT 3, "
                "background_opacity INTEGER NOT NULL DEFAULT 100, "
                "background_pages TEXT NOT NULL DEFAULT '[\"home\"]', "
                 "homepage_content TEXT NOT NULL DEFAULT '{}', "
                 "homepage_layout TEXT NOT NULL DEFAULT '{}', "
                 "logo_data_url TEXT NOT NULL DEFAULT '', "
                 "logo_width INTEGER NOT NULL DEFAULT 160, "
                 "logo_height INTEGER NOT NULL DEFAULT 64, "
                 "updated_at TIMESTAMPTZ DEFAULT NOW()"
                ")"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE site_settings "
                "ADD COLUMN IF NOT EXISTS site_name VARCHAR(200) NOT NULL DEFAULT ''"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE site_settings "
                "ADD COLUMN IF NOT EXISTS site_title VARCHAR(200) NOT NULL DEFAULT 'Mecánico en Cóbano'"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE site_settings "
                "ADD COLUMN IF NOT EXISTS site_tagline VARCHAR(300) NOT NULL DEFAULT 'Diagnóstico, mantenimiento y reparacion automotriz'"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE site_settings "
                "ADD COLUMN IF NOT EXISTS background_images TEXT NOT NULL DEFAULT '[]'"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE site_settings "
                "ADD COLUMN IF NOT EXISTS background_image_count INTEGER NOT NULL DEFAULT 3"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE site_settings "
                "ADD COLUMN IF NOT EXISTS background_opacity INTEGER NOT NULL DEFAULT 100"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE site_settings "
                "ADD COLUMN IF NOT EXISTS background_pages TEXT NOT NULL DEFAULT '[\"home\"]'"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE site_settings "
                "ADD COLUMN IF NOT EXISTS homepage_content TEXT NOT NULL DEFAULT '{}'"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE site_settings "
                "ADD COLUMN IF NOT EXISTS homepage_layout TEXT NOT NULL DEFAULT '{}'"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE site_settings "
                "ADD COLUMN IF NOT EXISTS logo_width INTEGER NOT NULL DEFAULT 160"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE site_settings "
                "ADD COLUMN IF NOT EXISTS logo_height INTEGER NOT NULL DEFAULT 64"
            )
        )
        conn.execute(
            text(
                "INSERT INTO site_settings (id, logo_data_url) "
                "VALUES (1, '') "
                "ON CONFLICT (id) DO NOTHING"
            )
        )
        conn.execute(
            text(
                "UPDATE site_settings "
                "SET homepage_content = :homepage_content "
                "WHERE homepage_content IS NULL OR homepage_content IN ('', '{}')"
            ),
            {"homepage_content": json.dumps(DEFAULT_HOMEPAGE_CONTENT, ensure_ascii=False)},
        )
        conn.execute(
            text(
                "UPDATE site_settings "
                "SET homepage_layout = :homepage_layout "
                "WHERE homepage_layout IS NULL OR homepage_layout IN ('', '{}')"
            ),
            {"homepage_layout": json.dumps(DEFAULT_HOMEPAGE_LAYOUT)},
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
                "ADD COLUMN IF NOT EXISTS engine VARCHAR(100) NOT NULL DEFAULT ''"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE vehicles "
                "ADD COLUMN IF NOT EXISTS plate_key VARCHAR(20) NOT NULL DEFAULT ''"
            )
        )
        conn.execute(
            text(
                "UPDATE vehicles "
                "SET plate_key = UPPER(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g')) "
                "WHERE plate_key = '' OR plate_key IS NULL"
            )
        )
        conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS client_vehicles ("
                "id SERIAL PRIMARY KEY, "
                "client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE, "
                "vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE, "
                "created_at TIMESTAMPTZ DEFAULT NOW(), "
                "CONSTRAINT uq_client_vehicle UNIQUE (client_id, vehicle_id)"
                ")"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_client_vehicles_vehicle_id "
                "ON client_vehicles (vehicle_id)"
            )
        )
        # migrate existing ownership from vehicles.client_id to client_vehicles
        # (guarded: only when the legacy column still exists)
        has_client_id = conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = 'vehicles' AND column_name = 'client_id'"
            )
        ).scalar_one_or_none()
        if has_client_id:
            conn.execute(
                text(
                    "INSERT INTO client_vehicles (client_id, vehicle_id) "
                    "SELECT vehicles.client_id, vehicles.id FROM vehicles "
                    "WHERE vehicles.client_id IS NOT NULL "
                    "ON CONFLICT DO NOTHING"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE vehicles "
                    "DROP COLUMN IF EXISTS client_id"
                )
            )
        # dedupe vehicles by plate_key: reassign ownership to master, delete dups
        conn.execute(
            text(
                "INSERT INTO client_vehicles (client_id, vehicle_id) "
                "SELECT DISTINCT cv.client_id, v.master_id "
                "FROM client_vehicles cv "
                "JOIN vehicles veh ON veh.id = cv.vehicle_id "
                "JOIN (SELECT plate_key, MIN(id) AS master_id FROM vehicles "
                "      GROUP BY plate_key HAVING COUNT(*) > 1) v ON veh.plate_key = v.plate_key "
                "WHERE veh.id <> v.master_id "
                "ON CONFLICT DO NOTHING"
            )
        )
        conn.execute(
            text(
                "DELETE FROM vehicles veh "
                "USING (SELECT plate_key, MIN(id) AS master_id FROM vehicles "
                "       GROUP BY plate_key HAVING COUNT(*) > 1) v "
                "WHERE veh.plate_key = v.plate_key AND veh.id <> v.master_id"
            )
        )
        conn.execute(
            text(
                "DROP INDEX IF EXISTS ix_vehicles_plate"
            )
        )
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_vehicles_plate_key "
                "ON vehicles (plate_key)"
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
        # Service history extras
        conn.execute(
            text(
                "ALTER TABLE service_records "
                "ADD COLUMN IF NOT EXISTS other_photos JSON NOT NULL DEFAULT '[]'"
            )
        )
        conn.execute(
            text(
                "ALTER TABLE service_price_rows "
                "ADD COLUMN IF NOT EXISTS currency VARCHAR(5) NOT NULL DEFAULT 'CRC'"
            )
        )
        # The old Valoración / Reparación tables are replaced by the
        # service_orders module. Drop them (their data was intentionally removed).
        conn.execute(text("DROP TABLE IF EXISTS vehicle_repairs"))
        conn.execute(text("DROP TABLE IF EXISTS vehicle_visits"))
        # The Órdenes de Servicio module has been replaced by the service history
        # (Historial de Servicios). Drop its tables and data entirely.
        conn.execute(text("DROP TABLE IF EXISTS order_parts"))
        conn.execute(text("DROP TABLE IF EXISTS service_works"))
        conn.execute(text("DROP TABLE IF EXISTS diagnostics"))
        conn.execute(text("DROP TABLE IF EXISTS vehicle_conditions"))
        conn.execute(text("DROP TABLE IF EXISTS service_orders"))
        conn.commit()


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}


app.include_router(public.router)
app.include_router(mechanic.router)
app.include_router(client_auth_router)
app.include_router(events.router)
app.include_router(i18n_router.router)
