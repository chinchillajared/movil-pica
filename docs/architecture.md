# Architecture

## System overview

The application is a Docker Compose stack with four services:

```
┌────────────────────────────────────────────────────────────┐
│                        Docker network                      │
│                                                            │
│   Browser ──► frontend (nginx) ──► /api/* ──► backend      │
│                   :8081                   (FastAPI)        │
│                                            │               │
│                    pgadmin ───────────────►│► db (Postgres)│
│                      :8080                  (internal)     │
└────────────────────────────────────────────────────────────┘
```

| Service   | Image              | Exposed | Role                                              |
|-----------|--------------------|---------|---------------------------------------------------|
| `db`      | postgres:16-alpine | no      | PostgreSQL 16, persistent volume `pgdata`         |
| `pgadmin` | dpage/pgadmin4     | 8080    | Optional database admin UI                        |
| `backend` | custom (python)    | no      | FastAPI application, SQLAlchemy, SSE              |
| `frontend`| custom (nginx)     | 8081    | Serves static site + reverse-proxies `/api/`      |

The database is **only reachable from inside the Docker network**; the backend
connects through the internal hostname `db`.

## Components

### Frontend (nginx)

- Serves static HTML + vanilla JavaScript + Tailwind CSS from the container
  document root.
- Reverse-proxies every `/api/` request to the backend container (`backend:8000`).
- SPA-style fallback: unknown paths under `/` fall back to `/user/index.html`.
- Serves icons from `/icons/` (static SVG files).
- Built with a **multi-stage Dockerfile**: `node:20-alpine` compiles Tailwind
  (`src/input.css → shared/styles.css`), then the output is copied into an
  `nginx:alpine` image.

### Backend (FastAPI)

- FastAPI app with routers for public endpoints, client authentication, the
  mechanic panel, SSE and i18n.
- SQLAlchemy 2.0 ORM + Pydantic v2 schemas.
- Startup runs `Base.metadata.create_all()` to ensure tables exist.
- Publish/subscribe event manager feeds a Server-Sent Events (SSE) stream.
- Mechanic reminders are persisted in PostgreSQL and scoped to the authenticated
  mechanic account; they are not stored in browser `localStorage`.

### Database (PostgreSQL)

- All persistence. See [database.md](database.md) for the schema.

## Request flow

1. **Static assets / pages** are served directly by nginx (no backend round-trip).
2. **API calls** (`/api/...`) are proxied to the backend.
3. Backend validates with Pydantic, queries via SQLAlchemy, and returns JSON.
4. **Real-time updates** are pushed to connected browsers over the SSE stream
   (`/api/events/stream`) whenever an appointment, vehicle or announcement
   changes.

## Authentication & authorization

- **Mechanic panel:** JWT access/refresh tokens. The access token is sent on every
  request via the `X-Mechanic-Key` header and stored in `localStorage`. Refresh
  tokens extend the session.
- **Client (public) site:** JWT tokens sent via the standard
  `Authorization: Bearer` header.
- Tokens carry a **subject** (user id), an **audience** (`client` | `mechanic`)
  and a **purpose** (`access` | `refresh`) so a refresh token can never be used as
  an access token and client tokens can never hit mechanic routes.
- Passwords are hashed with **bcrypt** (unique salt per user).
- Roles: `admin` (full access) and `mechanic` for panel users; `require_admin`
  gates user management and client deletion.

## Rate limiting

A per-IP, in-memory rate limiter is applied to public form submissions, login,
bootstrap, and other sensitive endpoints. Configured via `RATE_LIMIT_MAX` and
`RATE_LIMIT_WINDOW`.

## Realtime (SSE)

- The backend keeps in-memory subscriber queues and publishes events:
  - `appointment` — created / updated (status, reservation) / deleted.
  - `vehicle` — vehicle or work-record changes.
  - `announcement` — announcements added/updated.
  - `reminder` — mechanic dashboard reminder created/completed.
  - `settings` — schedule / site setting changes.
- The client pages listen on `/api/events/stream` and refresh their data
  automatically (e.g. the client appointments list updates without a manual
  refresh).

## Key design decisions

### Canonical vehicles

Vehicles are identified by a normalized `plate_key` (uppercase, non-alphanumerics
removed), so `ABC-123` and `ABC123` are the same vehicle and never duplicate.
Ownership is **many-to-many** (`client_vehicles`): registering a plate that
already exists **links** the client to the canonical vehicle. A client "delete"
only unlinks the client; the vehicle (and its service history) remain.

### Service history

Each vehicle has a chronological log of **service records** (`service_records`).
A record stores the symptom or repair title ("Síntoma o reparación"), the
diagnosis or notes, the odometer reading (with unit `km`/`mi` and a **required**
photo), optional **extra photos** (`other_photos` JSON), and a list of
**price rows** (`service_price_rows`) of kind `labor` (mano de obra) or `parts`
(repuestos). Each price row carries a **currency** (`CRC` colones / `USD`
dólares) and an amount; the amounts are summed into a total. Deleting a vehicle
cascades to all its records and their price rows.

Clients can view their vehicles' service history through
`GET /api/auth/repairs` (returns `ServiceRecordOut` for every vehicle they own)
and can **edit** their own vehicles with `PUT /api/auth/vehicles/{id}`
(owner-only).

### Appointment availability

- The client calendar disables past dates, days off and dates with active
  bookings (fetched from the API).
- The **appointment time** setting controls how each booking blocks
  availability:
  - **Hours:** the day stays available with fewer time slots.
  - **Days:** the booked day (and the following ones) become unavailable.
- Each appointment can hold **extra reserved days** (`reserved_dates` JSON),
  added to the taken dates so other clients cannot book them.
- Time slots use 12-hour labels in the UI but are stored/transmitted in 24-hour
  format.

### Emails

- When activated, emails go through the **Gmail API** (OAuth 2.0).
- Otherwise the legacy **SMTP** fallback (`EMAIL_ADDRESS` / `EMAILAPP_PASSWORD`)
  is used.
- If neither is configured, sending is skipped silently.

### Mechanic dashboard reminders

The mechanic `Inicio` view loads a weekly operational summary from the
appointments and vehicles APIs. Manual reminders use the authenticated mechanic
API and are stored in `mechanic_reminders`, keyed by `users.id`. The dashboard
only displays pending reminders; marking one complete updates its persisted
`is_completed` state.

### Internationalization (i18n)

- Frontend UI strings: `frontend/locales/es.json` + `en.json`.
- Backend API error messages: `backend/translations/es.json` + `en.json`.
- Both must be kept in sync when adding keys.
