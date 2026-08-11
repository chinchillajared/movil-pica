# Database

## Engine & connection

| Item           | Value                                                        |
|----------------|--------------------------------------------------------------|
| Engine         | PostgreSQL 16                                                |
| Connection     | `postgresql+psycopg2://mechanic:PASSWORD@db:5432/appointments` |
| ORM            | SQLAlchemy 2.0 (declarative mapping)                         |
| Volume         | `pgdata` — persists across container restarts                |
| Health check   | `pg_isready` every 5s before the backend starts              |

The schema is defined in `backend/app/models.py`. Tables are created
automatically on backend startup via `Base.metadata.create_all()` (no migration
tool is used).

## Tables

### `appointments` — client appointment requests

| Column              | Type          | Notes                                   |
|---------------------|---------------|-----------------------------------------|
| `id`                | `INTEGER`     | Primary key, auto-increment             |
| `appointment_number`| `VARCHAR(20)` | Unique, e.g. `APT-20260616-0001`        |
| `first_name`        | `VARCHAR(100)`|                                         |
| `last_name`         | `VARCHAR(100)`|                                         |
| `phone`             | `VARCHAR(30)` |                                         |
| `country_code`      | `VARCHAR(10)` | e.g. `+506`, `+1`                       |
| `email`             | `VARCHAR(255)`| Optional, used for notifications        |
| `plate`             | `VARCHAR(20)` | License plate (uppercased on submit)    |
| `address`           | `TEXT`        |                                         |
| `appointment_date`  | `DATE`        |                                         |
| `appointment_time`  | `TIME`        |                                         |
| `reserved_dates`    | `JSON`        | Extra specific days (ISO) this appointment is reserved on |
| `status`            | `VARCHAR(20)` | `pending` / `confirmed` / `completed` / `cancelled` |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | Auto-managed timestamps     |

### `clients` — public site accounts

| Column         | Type          | Notes                                |
|----------------|---------------|--------------------------------------|
| `id`           | `INTEGER`     | Primary key                          |
| `first_name`   | `VARCHAR(100)`|                                      |
| `last_name`    | `VARCHAR(100)`|                                      |
| `email`        | `VARCHAR(255)`| Unique, indexed, stored lowercase    |
| `phone`        | `VARCHAR(30)` |                                      |
| `country_code` | `VARCHAR(10)` |                                      |
| `password_hash`| `VARCHAR(255)`| bcrypt hash                          |
| `created_at` / `updated_at` | `TIMESTAMPTZ` |                     |

### `users` — mechanic panel accounts

| Column         | Type          | Notes                                   |
|----------------|---------------|-----------------------------------------|
| `id`           | `INTEGER`     | Primary key                             |
| `name`         | `VARCHAR(100)`|                                         |
| `email`        | `VARCHAR(255)`| Unique, indexed                         |
| `password_hash`| `VARCHAR(255)`| bcrypt hash                             |
| `role`         | `VARCHAR(20)` | `admin` / `mechanic` (check constraint) |
| `is_active`    | `BOOLEAN`     | Default `true`                          |
| `created_at` / `updated_at` | `TIMESTAMPTZ` |                    |

### `vehicles` — canonical vehicle cards

| Column        | Type          | Notes                                          |
|---------------|---------------|------------------------------------------------|
| `id`          | `INTEGER`     | Primary key                                    |
| `plate`       | `VARCHAR(20)` | Display plate                                  |
| `plate_key`   | `VARCHAR(20)` | **Unique** canonical key (uppercase, no spaces/dashes) |
| `make`        | `VARCHAR(80)` |                                                |
| `model`       | `VARCHAR(80)` |                                                |
| `year`        | `INTEGER`     | Nullable                                       |
| `color`       | `VARCHAR(40)` |                                                |
| `front_photo` | `TEXT`        | Single front photo (base64 data URL)           |
| `created_at` / `updated_at` | `TIMESTAMPTZ` |                     |

### `client_vehicles` — many-to-many ownership link

| Column      | Type      | Notes                                  |
|-------------|-----------|----------------------------------------|
| `id`        | `INTEGER` | Primary key                            |
| `client_id` | `INTEGER` | FK → `clients.id`, `ON DELETE CASCADE` |
| `vehicle_id`| `INTEGER` | FK → `vehicles.id`, `ON DELETE CASCADE`|
| `created_at`| `TIMESTAMPTZ` |                                    |

Unique per `(client_id, vehicle_id)`.

### `service_records` — Historial de Servicios (one entry per vehicle service)

| Column          | Type          | Notes                                          |
|-----------------|---------------|------------------------------------------------|
| `id`            | `INTEGER`     | Primary key                                    |
| `vehicle_id`    | `INTEGER`     | FK → `vehicles.id`, `ON DELETE CASCADE`        |
| `title`         | `TEXT`        | "Síntoma o reparación" (symptom or repair)     |
| `diagnosis`     | `TEXT`        | "Diagnóstico o notas" (diagnosis or notes)     |
| `mileage`       | `INTEGER`     | Odometer reading (nullable)                    |
| `mileage_unit`  | `VARCHAR(5)`  | `km` / `mi`                                    |
| `mileage_photo` | `TEXT`        | Odometer photo (base64) — required when creating from the panel |
| `other_photos`  | `JSON`        | Extra photos (list of base64 data URLs)        |
| `created_at` / `updated_at` | `TIMESTAMPTZ` |                     |

### `service_price_rows` — Precios (rows of labor / parts per service record)

| Column        | Type           | Notes                                             |
|---------------|----------------|---------------------------------------------------|
| `id`          | `INTEGER`      | Primary key                                       |
| `record_id`   | `INTEGER`      | FK → `service_records.id`, `ON DELETE CASCADE`    |
| `kind`        | `VARCHAR(10)`  | `labor` (mano de obra) / `parts` (repuestos)      |
| `currency`    | `VARCHAR(5)`   | `CRC` (colones) / `USD` (dólares)                 |
| `description` | `TEXT`         |                                                   |
| `amount`      | `NUMERIC(12,2)`| (nullable)                                        |
| `created_at`  | `TIMESTAMPTZ`  |                                                   |

### Settings / config tables

| Table                          | Notes                                                    |
|--------------------------------|----------------------------------------------------------|
| `announcements`                | Banner messages: `text`, `bg_color`, `duration_hours`, `is_permanent`, `is_active` |
| `work_schedule`                | Per-day start/end times + optional lunch break (JSON `days`) |
| `days_off`                     | Non-working dates (`day_off` unique) + optional `reason`  |
| `appointment_time_settings`    | `unit` (`hours`/`days`) + `value` — how long each booking blocks availability |
| `gmail_settings`               | Singleton (`id=1`): Gmail OAuth credentials, tokens, state |
| `site_settings`                | Singleton (`id=1`): uploaded `logo_data_url` (base64)      |

## Relationships

```
clients ──< client_vehicles >── vehicles ──< service_records
   │                                 │              │
   │                                 │              └──< service_price_rows
   │                                 │
   └──────────── (appointments are standalone, no FK) ──────┘

appointments   — independent records (email/phone used to match clients)
announcements  — standalone
users          — standalone
```

- **`vehicles` ↔ `clients`:** many-to-many through `client_vehicles`. Deleting a
  client cascades the link rows (the vehicles remain). Deleting a vehicle
  cascades to its `service_records` (and their price rows).
- **`appointments`:** no foreign keys — they are matched to a client by email or
  phone for the client's *Citas* list. Deleting a client does **not** delete
  their appointments.
