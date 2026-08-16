# API Reference

All endpoints are under the `/api` prefix. Responses are JSON. Endpoints that
create/update/delete data may be rate-limited per IP.

## Public (no auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/appointments` | Create a new appointment (rate-limited) |
| GET    | `/api/appointments/taken-dates?year=&month=&exclude=` | ISO dates with bookings (1-indexed month); optional `exclude` = appointment number whose own date/time stays selectable (used when editing) |
| GET    | `/api/appointments/times?for_date=` | Taken time slots for a date |
| GET    | `/api/appointments/lookup?phone=&plate=` | Lookup appointment by phone + plate |
| PUT    | `/api/appointments/{number}` | Update an appointment |
| PATCH  | `/api/appointments/{number}/cancel` | Cancel an appointment |
| GET    | `/api/schedule` | Current work schedule |
| GET    | `/api/announcements/active` | Active announcement banner |
| GET    | `/api/site/settings` | Site settings (`logo_data_url`, `logo_width`, `logo_height`, backgrounds and homepage content) |
| GET    | `/api/health` | Health check |

## Client auth (`/api/auth`) — requires `Authorization: Bearer <token>`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/register` | Register a client account (rate-limited) |
| POST   | `/login` | Login (returns access + refresh token) |
| POST   | `/refresh` | Exchange refresh token for a new access token |
| GET    | `/me` | Current client profile |
| GET    | `/vehicles` | List my vehicles |
| POST   | `/vehicles` | Register a vehicle (creates or **auto-links** to an existing one by plate) |
| PUT    | `/vehicles/{id}` | Edit my vehicle (owner-only; 404 if the vehicle is not linked to the client) |
| DELETE | `/vehicles/{id}` | **Unlink** my vehicle (canonical vehicle and its service history are kept) |
| GET    | `/appointments` | My appointments (matched by email or phone), newest first |
| GET    | `/repairs` | Service history for my vehicles (list of `ServiceRecordOut`), newest first |

## Mechanic (`/api/mechanic`) — requires `X-Mechanic-Key` header (JWT), except `bootstrap` and `login`

### Auth & users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/bootstrap` | `{ needs_setup }` — true when no users exist |
| POST   | `/bootstrap` | Create the first admin (only when no users exist) |
| POST   | `/login` | Login with email + password |
| POST   | `/refresh` | Refresh tokens |
| GET    | `/me` | Current user profile |
| PUT    | `/me/password` | Change own password |
| GET    | `/users` *(admin)* | List panel users |
| POST   | `/users` *(admin)* | Create user |
| PUT    | `/users/{id}` *(admin)* | Update user (name/role/is_active) |
| POST   | `/users/{id}/reset-password` *(admin)* | Reset a user's password |
| DELETE | `/users/{id}` *(admin)* | Delete user |

### Reminders

Reminders are private to the authenticated mechanic account. Completed reminders
are not returned by the list endpoint.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/reminders` | List the current user's pending reminders |
| POST   | `/reminders` | Create a reminder (`{"text":"..."}`) |
| PATCH  | `/reminders/{id}` | Update completion state (`{"is_completed":true}`) |

### Gmail

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/gmail/settings` | Gmail integration settings |
| PUT    | `/gmail/settings` | Save Gmail client credentials |
| GET    | `/gmail/auth-url` | Get Google OAuth authorization URL |
| GET    | `/gmail/callback` | OAuth redirect callback (no auth) |
| POST   | `/gmail/test` | Send a test email |
| POST   | `/gmail/deactivate` | Deactivate Gmail integration |

### Clients

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/clients` | List registered clients |
| GET    | `/clients/{client_id}/vehicles` | Vehicles owned by a client |
| DELETE | `/clients/{client_id}` *(admin)* | Delete a client (unlinks vehicles; appointments are kept) |
| POST   | `/emails/send` | Send an email to a recipient |

### Appointments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/appointments?status=&date_from=` | List appointments (optional status filter and `date_from`) |
| POST   | `/appointments` | Create appointment (manual) |
| PATCH  | `/appointments/{number}` | Update status (e.g. `{"status":"confirmed"}`) |
| PUT    | `/appointments/{number}/reservation` | Update extra reserved days (`{"reserved_dates":["YYYY-MM-DD",...]}`) |
| DELETE | `/appointments/{number}` | Delete an appointment |
| GET    | `/calendar?year=&month=` | Calendar bookings for a month |

### Announcements & settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/announcements` | List announcements |
| POST   | `/announcements` | Create announcement |
| PUT    | `/announcements/{id}` | Update announcement |
| DELETE | `/announcements/{id}` | Delete announcement |
| GET/PUT| `/schedule` | Get / update work schedule |
| GET    | `/days-off` | List days off |
| POST   | `/days-off` | Add a day off |
| DELETE | `/days-off/{date}` | Remove a day off |
| GET/PUT| `/appointment-time` | Get / update appointment time settings |
| GET/PUT| `/settings/site` | Get / update site settings (logo, dimensions, backgrounds and homepage content) |

`PUT /settings/site` accepts optional `logo_width` (`80–320`) and
`logo_height` (`32–120`) values in pixels. Logo uploads use `logo_data_url`; the
public site renders white/transparent logo background pixels as the navy brand
color `#0b1628`.

### Vehicles & service history

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/vehicles?q=` | Search vehicles by plate/make/model |
| POST   | `/vehicles` | Register a vehicle |
| GET    | `/vehicles/{id}` | Vehicle detail (photos, owners, service history) |
| PUT    | `/vehicles/{id}` | Update a vehicle |
| DELETE | `/vehicles/{id}` | Delete a vehicle and its service history |
| GET    | `/vehicles/{id}/history` | List a vehicle's service history |
| POST   | `/vehicles/{id}/history` | Create a service record (Historial de Servicios) |
| GET    | `/history/{id}` | Get a full service record (title, diagnosis, mileage, price rows) |
| PUT    | `/history/{id}` | Update a service record |
| DELETE | `/history/{id}` | Delete a service record |

## Realtime

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/events/stream` | Server-Sent Events stream. Events: `appointment`, `vehicle`, `announcement`, `reminder`, `settings` |

## Notes

- Mechanic endpoints use the `X-Mechanic-Key` header; client endpoints use
  `Authorization: Bearer`.
- Endpoints marked *(admin)* require the authenticated user to have the `admin`
  role.
- Full OpenAPI/Swagger documentation is available at `/docs` (FastAPI).
