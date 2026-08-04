# Mecánico móvil — Appointment Scheduler

A self-contained web app for a mobile mechanic business. Clients can schedule
appointments, check their status, and create accounts. The mechanic has a
multi-user panel (roles: admin / mechanic) with calendar, announcements,
settings, and a Gmail email integration.

## Stack

| Layer       | Technology                                                              |
|-------------|-------------------------------------------------------------------------|
| **Backend** | Python 3.11 + FastAPI + SQLAlchemy 2.0 + Pydantic v2                    |
| **Database**| PostgreSQL 16 (Alpine), persistent volume                                |
| **Frontend**| Static HTML + vanilla JavaScript + Tailwind CSS 3 (built by nginx)      |
| **Server**  | nginx (serves static files, reverse-proxies `/api/` to backend)         |
| **DB admin**| pgAdmin 4 (optional, on port 8080)                                      |
| **Auth**    | JWT access/refresh tokens, bcrypt password hashing, per-IP rate limits  |
| **Email**   | Gmail API (OAuth 2.0) with legacy SMTP fallback                         |
| **Realtime**| Server-Sent Events (SSE) for live appointment/announcement updates      |
| **i18n**    | Spanish & English, auto-detected from `navigator.language`, manual toggle in the header gear/settings menu |

## Features

### Public site
- Home page with **Schedule an appointment** and **Check status**
- 3-step scheduling wizard: date → time → personal details
- Human-friendly appointment number (e.g. `APT-20260616-0001`)
- Client accounts: register / login, session tokens, form auto-prefill
- Compact header: when logged out it shows an **Iniciar sesión/Registrarse** button
  and a gear icon; when logged in it shows **"Hola, {nombre}"** plus the gear icon.
  The gear menu holds the **language switcher**, **My account** (opens the
  login/register modal, or shows the profile when logged in) and **Sign out**
- Optional email on appointment (used for email notifications)
- Bilingual UI (ES / EN) — auto-detected, manual switcher in the gear menu
- Calendar grays out past dates, days off, and dates with existing non-cancelled appointments
- Time slots filtered to show only available times for the selected date
- Active announcements banner

### Mechanic panel
- **First-run setup:** when the panel has no users yet, the login page shows a
  *"Create admin"* form — the first account ever created becomes the main
  administrator (role `admin`)
- Multi-user authentication with **email + password** (JWT access/refresh tokens)
- Roles: `admin` (full access + user management) and `mechanic`
- Views: appointment list (filter by status/date), calendar, announcements,
  registered clients, users, settings, and **vehicle history**
- **Vehicle history (Historial de Vehículos):** register vehicles by license
  plate with make/model/year/color and a single **front photo** (base64 in DB);
  then add work visits per vehicle. Each work visit records a **title** (e.g.
  "Problema de arranque") plus its **date (today is saved automatically)** and
  is split in two parts: **Assessment (Valoración)**
  — general state of the vehicle: **mileage photo**, **fuel-level photo**,
  **condition photos** (front / left / right / rear), **defect/observation
  photos**, observations and **belongings** (text + photos) — and **Jobs
  (Trabajos)** — each job with **work photos**, a **diagnostic** and
  observations. Several records can exist on the **same date** (they are
   distinguished by their title (titles must be unique per vehicle); when creating a new record the form offers
  **"Usar fotos de valoración del trabajo anterior"** to reuse the assessment
  photos of a previous record. The visit list shows each record's **title and
  creation date**;
  clicking a visit opens a
  modal with those two tabs. A new visit is created with the assessment first;
  jobs are then added manually from the Jobs tab (each job has its own
  add/edit/delete form). A vehicle can have many visits, shown as a
  chronological log. Searchable by plate/make/model.
- Appointment status workflow: `pending → confirmed → completed`, plus `cancelled`
- Manual appointment creation with optional client email
- **Unified header:** a single gear icon opens a menu with the logged-in user
  (name + role), the **language switcher**, **My account** (shows name, email and
  role, plus a button to change the password) and **Sign out**
- **Settings:** per-day work schedule, days off, and appointment time
  reservation (in hours or days), all with highlighted button pickers:
  - **Work days:** start/end times chosen with **hour (1–12)**, **minutes
    (00–59)** and **am/pm** dropdowns; an optional **lunch break** toggle with its
    own start/end pickers blocks those slots for clients; changing a start/end
    time offers **"Apply this schedule to other days?"** with a button per other
    working day
  - **Appointment time:** **Unidad** (Horas / Días) and **Tiempo reservado**
    value buttons with a highlighted active option
  - **Days off:** a calendar-icon button opens the same month calendar used for
    client/appointment scheduling; the chosen day is shown in full text
    (e.g. *Miércoles 8 de Marzo del 2026*)
- **User management (admin only):** create/edit users, reset passwords, activate/deactivate, delete
- **Clients view:** list registered clients and send emails to them
- **Gmail integration:** OAuth 2.0 setup to send appointment and test emails from the panel

## Quick start

```bash
# Edit the .env file first (see Configuration below)
docker compose up -d --build
```

Then open:

- **User site:**  http://localhost:8081/
- **Mechanic:**   http://localhost:8081/mechanic/
- **pgAdmin:**    http://localhost:8080/   (login with the `PGADMIN_*` env vars)

> The first build pulls images and runs `npm install` for Tailwind, so it may take
> a couple of minutes. Subsequent starts are near-instant.

**First use of the mechanic panel:** open `/mechanic/` with no users in the
database and you will be asked to create the administrator account (name, email,
password). That first account has the `admin` role.

## Configuration

All settings come from environment variables (see `.env`):

| Variable                  | Default        | Description                              |
|---------------------------|----------------|------------------------------------------|
| `POSTGRES_USER`           | `mechanic`     | Postgres role                            |
| `POSTGRES_PASSWORD`       | `changeme`     | Postgres password                        |
| `POSTGRES_DB`             | `appointments` | Database name                            |
| `PGADMIN_DEFAULT_EMAIL`   | `admin@local.com` | pgAdmin login email                   |
| `PGADMIN_DEFAULT_PASSWORD`| `changeme`     | pgAdmin login password                  |
| `PGADMIN_PORT`            | `8080`         | Host port for pgAdmin                    |
| `FRONTEND_PORT`           | `8081`         | Host port for the user/mechanic site     |
| `ALLOWED_ORIGINS`         | `http://localhost:8081,http://localhost:8080` | CORS allow-list |
| `SITE_URL`                | `http://localhost:8081` | Public base URL (used for the Gmail OAuth redirect) |
| `JWT_SECRET`              | `changeme-secret-key` | Secret used to sign JWT tokens       |
| `ACCESS_TOKEN_MINUTES`    | `60`           | Access token lifetime (minutes)         |
| `REFRESH_TOKEN_DAYS`      | `30`           | Refresh token lifetime (days)           |
| `EMAIL_ADDRESS`           | *(empty)*      | Legacy SMTP sender address (fallback)   |
| `EMAILAPP_PASSWORD`       | *(empty)*      | Legacy SMTP app password (fallback)     |
| `RATE_LIMIT_MAX`          | `20`           | Max requests per window per IP          |
| `RATE_LIMIT_WINDOW`       | `60`           | Rate-limit window (seconds)             |

**Change `POSTGRES_PASSWORD`, `JWT_SECRET`, and the pgAdmin password before
deploying anywhere real.** The mechanic panel no longer uses a shared password —
accounts are created on first run and managed by the admin.

## Database

- **Engine:** PostgreSQL 16
- **Connection:** `postgresql+psycopg2://mechanic:PASSWORD@db:5432/appointments`
- **ORM:** SQLAlchemy 2.0 (declarative mapping with `mapped_column`)
- **Volume:** `pgdata` — persists across container restarts
- **Health check:** `pg_isready` every 5s before the backend starts

### Tables

**`appointments`** — client appointment requests:

| Column              | Type          | Notes                                |
|---------------------|---------------|--------------------------------------|
| `id`                | `INTEGER`     | Primary key, auto-increment          |
| `appointment_number`| `VARCHAR(20)` | Unique, e.g. `APT-20260616-0001`     |
| `first_name`        | `VARCHAR(100)`|                                      |
| `last_name`         | `VARCHAR(100)`|                                      |
| `phone`             | `VARCHAR(30)` |                                      |
| `country_code`      | `VARCHAR(10)` | e.g. `+506`, `+1` (normalized)       |
| `email`             | `VARCHAR(255)`| Optional, used for notifications     |
| `plate`             | `VARCHAR(20)` | License plate (uppercased on submit) |
| `address`           | `TEXT`        |                                      |
| `appointment_date`  | `DATE`        |                                      |
| `appointment_time`  | `TIME`        |                                      |
| `status`            | `VARCHAR(20)` | `pending` / `confirmed` / `completed` / `cancelled` |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | Auto-managed timestamps    |

Other tables:

- **`clients`** — public site accounts (name, email unique, phone, bcrypt hash)
- **`users`** — mechanic panel accounts (`role` admin/mechanic, `is_active`)
- **`announcements`** — banner messages with color and duration
- **`work_schedule`** — per-day start/end times plus optional lunch break (JSON)
- **`days_off`** — non-working dates
- **`appointment_time_settings`** — how long each appointment blocks availability (unit: hours/days)
- **`gmail_settings`** — Gmail OAuth credentials and state (singleton row `id=1`)
- **`vehicles`** — vehicle cards keyed by unique plate; single front photo stored as base64 text
- **`vehicle_visits`** — work records (title, date, mileage photo, fuel-level photo, condition photos front/left/right/rear, defects/observations photos, observations, belongings + belongings photos, jobs with photos + diagnostic + observations) per vehicle (FK `vehicles.id`, cascade delete)

## Gmail integration (optional)

To send emails (appointment notifications, client emails, test emails):

1. In the [Google Cloud Console](https://console.cloud.google.com) enable the
   **Gmail API** and create an **OAuth 2.0 Client ID** of type *Web*.
2. Add an **Authorized redirect URI** equal to
   `SITE_URL` + `/api/mechanic/gmail/callback`
   (e.g. `http://localhost:8081/api/mechanic/gmail/callback`).
3. In the mechanic panel go to **Settings → Integrations → Gmail**, enter the
   Client ID, Client Secret, and the sender Gmail address, save, and click
   **Authorize with Google**.
4. Use the **Send test email** button to verify.

> If Gmail is not configured, the legacy SMTP fallback (`EMAIL_ADDRESS` /
> `EMAILAPP_PASSWORD`) is used, otherwise sending is skipped silently.

## Reset (drop all data)

```bash
docker compose down -v
docker compose up -d --build
```

This wipes the database, so the mechanic panel will ask you to create the admin
again on next start.

## Connecting pgAdmin to the database

After pgAdmin loads:

1. Right-click **Servers** → **Register** → **Server…**
2. **General** tab: any name (e.g. `mechanic-db`)
3. **Connection** tab:
   - Host: `db`
   - Port: `5432`
   - Maintenance DB: `appointments`
   - Username: `POSTGRES_USER`
   - Password: `POSTGRES_PASSWORD`

## Project layout

```
.
├── docker-compose.yml           # Services: db, pgadmin, backend, frontend
├── .env                         # Environment variable configuration
│
├── backend/                     # FastAPI Python service
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── translations/            # Server-side i18n JSON files
│   │   ├── es.json
│   │   └── en.json
│   └── app/
│       ├── main.py              # FastAPI app, CORS, startup migrations
│       ├── config.py            # Settings from env vars
│       ├── database.py          # SQLAlchemy engine + session factory
│       ├── models.py            # ORM models (all tables)
│       ├── schemas.py           # Pydantic request/response models
│       ├── deps.py              # Auth dependencies (mechanic/admin/client)
│       ├── security.py          # bcrypt password hashing
│       ├── token.py             # JWT creation/validation (audience + type)
│       ├── ratelimit.py         # In-memory per-IP rate limiter
│       ├── crud.py              # Database queries
│       ├── email_sender.py      # Gmail API (OAuth2) + SMTP fallback
│       ├── event_manager.py     # SSE pub/sub
│       ├── i18n.py              # Server-side translation helper
│       └── routers/
│           ├── public.py        # Public endpoints (appointments, schedule, announcements)
│           ├── client_auth.py   # Client register / login / refresh / me
│           ├── mechanic.py      # Panel auth, users, gmail, appointments, settings
│           ├── events.py        # SSE stream
│           └── i18n_router.py   # Translation file endpoint
│
└── frontend/                    # Static site served by nginx
    ├── Dockerfile               # Multi-stage: builds Tailwind, then copies to nginx
    ├── nginx.conf               # Reverse-proxy /api/, static file serving
    ├── package.json             # Tailwind CSS + PostCSS dev dependencies
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── src/input.css            # Tailwind source entry
    ├── locales/                 # Client-side i18n JSON (ES / EN)
    ├── shared/                  # Shared frontend assets
    │   ├── api.js               # Fetch wrapper — auto-prepends /api/, JSON parse
    │   ├── auth.js              # Client header + login/register modal (public site)
    │   ├── i18n.js              # Client-side translation engine
    │   └── styles.css           # Built Tailwind output
    ├── user/                    # User-facing pages
    │   ├── index.html            # Home (schedule / check status)
    │   ├── schedule.html         # 3-step appointment wizard
    │   └── status.html           # Appointment lookup form + result card
    └── mechanic/                # Mechanic panel pages
        ├── index.html            # Login / first-run admin setup
        ├── dashboard.html        # Appointments, calendar, announcements, clients,
        │                          # users, settings (schedule with button pickers,
        │                          # calendar-based days off, appointment time,
        │                          # Gmail integration), gear menu header
        └── create.html           # Manual appointment creation
```

## API reference

### Public (no auth)

| Method | Endpoint                        | Description                            |
|--------|---------------------------------|----------------------------------------|
| POST   | `/api/appointments`             | Create a new appointment (rate-limited)|
| GET    | `/api/appointments/taken-dates?year=&month=` | ISO dates with bookings (1-indexed month) |
| GET    | `/api/appointments/times?for_date=` | Taken time slots for a date         |
| GET    | `/api/appointments/lookup?phone=&plate=` | Lookup appointment by phone + plate |
| PUT    | `/api/appointments/{number}`    | Update appointment                    |
| PATCH  | `/api/appointments/{number}/cancel` | Cancel appointment                 |
| GET    | `/api/schedule`                 | Current work schedule                 |
| GET    | `/api/announcements/active`     | Active announcement banner            |
| GET    | `/api/health`                   | Health check                          |

### Client auth (`/api/auth`)

| Method | Endpoint     | Description                            |
|--------|--------------|----------------------------------------|
| POST   | `/register`  | Register a client account              |
| POST   | `/login`     | Login (returns access + refresh token) |
| POST   | `/refresh`   | Exchange refresh token for a new access token |
| GET    | `/me`        | Current client profile (Bearer token)  |

### Mechanic (`/api/mechanic`) — requires `X-Mechanic-Key` header (JWT), except `bootstrap` and `login`

| Method | Endpoint                        | Description                            |
|--------|---------------------------------|----------------------------------------|
| GET    | `/bootstrap`                    | `{ needs_setup }` — true when no users exist |
| POST   | `/bootstrap`                    | Create the first admin (only when no users exist) |
| POST   | `/login`                        | Login with email + password            |
| POST   | `/refresh`                      | Refresh tokens                         |
| GET    | `/me`                           | Current user profile                   |
| PUT    | `/me/password`                  | Change own password                    |
| GET    | `/users` *(admin)*              | List panel users                       |
| POST   | `/users` *(admin)*              | Create user                            |
| PUT    | `/users/{id}` *(admin)*         | Update user (name/role/is_active)      |
| POST   | `/users/{id}/reset-password` *(admin)* | Reset a user's password          |
| DELETE | `/users/{id}` *(admin)*         | Delete user                            |
| GET    | `/gmail/settings`               | Gmail integration settings             |
| PUT    | `/gmail/settings`               | Save Gmail client credentials          |
| GET    | `/gmail/auth-url`               | Get Google OAuth authorization URL     |
| GET    | `/gmail/callback`               | OAuth redirect callback (no auth)      |
| POST   | `/gmail/test`                   | Send a test email                      |
| POST   | `/gmail/deactivate`             | Deactivate Gmail integration           |
| GET    | `/clients`                      | List registered clients                |
| POST   | `/emails/send`                  | Send an email to a recipient           |
| GET    | `/appointments?status=&date_from=&date_to=` | List appointments            |
| POST   | `/appointments`                 | Create appointment (manual)            |
| PATCH  | `/appointments/{number}`        | Update status (e.g. `{"status":"confirmed"}`) |
| DELETE | `/appointments/{number}`        | Delete an appointment                  |
| GET    | `/calendar?year=&month=`        | Calendar bookings for a month          |
| GET    | `/announcements`                | List announcements                     |
| POST   | `/announcements`                | Create announcement                    |
| PUT    | `/announcements/{id}`           | Update announcement                    |
| DELETE | `/announcements/{id}`           | Delete announcement                    |
| GET/PUT| `/schedule`                     | Get / update work schedule             |
| GET    | `/days-off`                     | List days off                          |
| POST   | `/days-off`                     | Add a day off                          |
| DELETE | `/days-off/{date}`              | Remove a day off                       |
| GET/PUT| `/appointment-time`             | Get / update appointment time settings |

### Realtime

| Method | Endpoint        | Description                            |
|--------|-----------------|----------------------------------------|
| GET    | `/api/events/stream` | Server-Sent Events: `appointment`, `announcement` |

## Architecture notes

- **nginx** serves the static frontend and proxies `/api/` requests to the backend container.
- The database is only accessible from within the Docker network — the backend connects via the internal hostname `db`.
- The mechanic panel uses **JWT tokens**: the access token is sent on every request via the `X-Mechanic-Key` header and stored in `localStorage`; refresh tokens extend the session. Client tokens use the standard `Authorization: Bearer` header.
- Passwords are hashed with **bcrypt** (unique salt per user).
- **Rate limiting** is applied per IP (in-memory) on public form submissions, login, and bootstrap endpoints.
- Calendar availability is computed on the fly: the frontend fetches taken dates (and taken times per date) from the API and disables those cells client-side.
- The **appointment time** setting controls how each booking blocks availability: in *hours* the day stays available with fewer slots; in *days* the booked day (and following ones) become unavailable.
- Time slots use 12-hour labels (`8:00am`, `2:00pm`, etc.) but are stored and transmitted in 24-hour format.
- The backend exposes a global `RequestValidationError` handler so Pydantic
  validation failures return a clean message (e.g. `invalid email format`) instead
  of the raw `body.email: Value error, ...` detail; the client also validates the
  email format before submitting to avoid a server round-trip.
- Setting controls (appointment time, work-day hours) use **highlighted button
  groups** instead of native `<select>` dropdowns for a consistent look; the
  active option is rendered with the brand color (`bg-brand-600`).
- The **days-off** calendar picker reuses the same calendar look as the client and
  calendar views (month navigation, weekday headers, day grid) to keep the UI
  consistent across the app.
- Emails are sent through the **Gmail API** when activated; otherwise the legacy SMTP settings are used as a fallback, and if neither is configured, sending is skipped without error.
- Translations exist in two places: the backend `translations/` folder (for API error messages) and the frontend `locales/` folder (for UI strings). Both should be kept in sync.
- The frontend Docker image uses a multi-stage build: `node:20-alpine` builds Tailwind, then the output is copied into an `nginx:alpine` image for serving.
