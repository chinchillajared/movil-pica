# Mecánico Móvil — Appointment Scheduler

A self-contained web application for a mobile mechanic business. Clients can book
appointments, check their status, create accounts and manage their own **garage**
(appointments, vehicles and repairs). The mechanic has a multi-user panel with an
appointment calendar, a vehicle service-history log, manual appointment creation,
client management, announcements, settings, and a Gmail email integration.

> Technical documentation (architecture, database schema, API reference,
> configuration and deployment) lives in the [`docs/`](docs/) folder.

---

## Features

### For clients (public site)

- **Book an appointment** with a 3-step wizard: date → time → personal details.
  The calendar grays out past dates, days off and dates already taken, and only
  available time slots are shown.
- **Check appointment status** by phone + plate: view details, edit or cancel.
- **Client accounts** — register / log in to get a personalized experience.
- **Mi cuenta / Mi garaje (My account / My garage)** — signing in opens a choice
  between booking and the private vehicle area:
  - **Citas (Appointments):** a live list of your appointments with their status
    (updates automatically in real time — no refresh needed).
  - **Vehículos (Vehicles):** register your vehicles (plate, make, model, year,
    color and a front photo), view, **edit** or remove them. Registering a plate
    that already exists in the shop links you to the existing vehicle instead of
    creating a duplicate.
  - **Servicios (Historial de servicios):** the full service history of your
    vehicles. Each record shows the symptom/reparation, diagnosis, mileage with
    odometer photo, prices in colones or dollars, and extra photos — expand it
    to see the details. Updates automatically when the mechanic adds or changes
    records.
- **Announcements banner** at the top of the site.
- **Bilingual UI** (Spanish / English) — auto-detected from your browser, with a
  manual switcher in the header gear menu.
- Booking requires the client's phone, plate and address; email is not requested.

### For the mechanic (panel)

- **First-run setup:** with no accounts yet, the login page shows a *Create
  admin* form. The first account created becomes the main administrator
  (`admin`), and it can also **upload a site logo** shown in every header.
- **Workshop overview:** the `Inicio` screen summarizes appointments this week,
  pending confirmations, the next appointment, the weekly agenda, and important
  reminders.
- **Responsive navigation:** on phones, the mechanic panel keeps the menu button
  beside the logo, supports an explicit close button, closes after navigation,
  and closes when tapping outside the sidebar.
- **Persistent reminders:** mechanics can create reminders from `Inicio` and
  mark them as completed. Reminders are stored per mechanic account in
  PostgreSQL and are available across devices.
- **Roles:** `admin` (full access + user management + delete clients) and
  `mechanic`.
- **Appointment calendar:** month view colored by status; clicking a day lists
  each appointment with full name, time, plate, number and address, plus quick
  actions to **confirm, complete, cancel or delete** and an **Edit reservation**
  picker for extra reserved days. When the appointment's vehicle is registered,
  a blue **"Ver detalles"** link jumps straight to that vehicle's history.
- **Vehicle history (Historial de Vehículos):** one canonical vehicle per license
  plate, searchable by plate/make/model, showing its owner(s). Each vehicle has
  a chronological log of **Service History (Historial de Servicios)**. Every
  record captures a **Síntoma o reparación** (title), **Diagnóstico o notas**,
  **Kilometraje** (with km/mi unit and a required odometer photo), optional
  **other photos**, and a list of **Precios** — rows of *mano de obra* (labor)
  or *repuestos* (parts) entered in **colones (₡)** or **dollars ($)** with
  automatic thousand separators (e.g. 1,000). Labor total, parts total and
  grand total are summed automatically. Records can be added, edited and
  deleted from the panel.
- **Create appointment (manual):** pick date/time and fill the details. You can
  create it as a **Guest** or a **Registered client** — searching by name or
  last name autofills the client's info and lets you pick one of their registered
  vehicles.
- **Clients:** search registered clients, **send emails** to them, and (admin
  only) **delete** them.
- **Announcements:** create/edit/delete banner messages with a color and a
  duration (hours) or permanent.
- **Users (admin only):** create/edit users, reset passwords, activate/deactivate
  and delete.
- **Settings:** per-day work schedule (with optional lunch break), **days off**
  (multi-date calendar picker with reason), how long each appointment blocks
  availability (in hours or days), and public site customization. The site editor
  can upload the logo, use the navy brand background, and save its width and height
  independently.
- **Gmail integration:** OAuth 2.0 setup to send appointment, client and test
  emails directly from the panel.

---

## Quick start

```bash
# 1. Create and edit .env first (see Configuration below)
cp .env.example .env
# 2. Build and start everything:
docker compose up -d --build
```

Then open:

| Site        | URL                              |
|-------------|----------------------------------|
| Client site | http://localhost:8081/           |
| Mechanic    | http://localhost:8081/mechanic/  |
| pgAdmin     | http://localhost:8080/           |

> The first build pulls images and runs `npm install` for Tailwind, so it may
> take a couple of minutes. Subsequent starts are near-instant.

**First use of the mechanic panel:** open `/mechanic/` with no users in the
database and you will be asked to create the administrator account (name, email,
password, and optionally upload a logo). That first account has the `admin` role.

---

## How to use the app

### As a client

1. Open the site root (`/`).
2. **Agendar cita (Schedule):** pick a date, then a time, then enter your
   details (first name, last name, phone, plate and address).
   You'll get an appointment number (e.g. `APT-20260616-0001`).
3. **Consultar cita (Status):** enter the phone and plate used when booking to
   see the appointment, edit it or cancel it.
4. **Mi cuenta (My account):** after signing in, choose **Agendar cita** or
   **Mi garaje**. The garage shortcut opens the vehicle area directly, where you
   can add, edit (gear menu) or remove vehicles and open their service history.
5. Switch the language with the gear icon in the top-right corner.

### As the mechanic

1. Open `/mechanic/`. On first run, create the admin account; otherwise sign in
   with your email and password.
 2. From the panel use the navigation:
    - **Inicio** — review the weekly appointment summary, pending confirmations,
      next appointment and important reminders.
   - **Calendario de citas** — manage appointments day by day (confirm, complete,
     cancel, delete, edit reservations, jump to vehicle details).
   - **Historial de Vehículos** — search vehicles and open their service-history
     log; register new vehicles and add service records (symptom/repair,
     diagnosis, mileage + photo, and price rows).
   - **+** — create an appointment manually (Guest or Registered client).
   - **Clientes** — search clients, send them emails, and (as admin) delete them.
   - **Anuncios** — publish banner announcements.
   - **Usuarios** (admin only) — manage panel accounts.
   - **Configuración** — work schedule, days off, appointment time, Gmail and
     **Sitio**. In the Site tab, use **Cambiar logo**, then adjust **Ancho del logo**
     (`80–320px`) and **Altura del logo** (`32–120px`) and click **Guardar tamaño**.

---

## Documentation

Detailed technical documentation is organized under [`docs/`](docs/):

| Document                          | Contents                                        |
|-----------------------------------|-------------------------------------------------|
| [Architecture](docs/architecture.md) | System components, request flow, auth, realtime |
| [Database](docs/database.md)         | Engine, tables, columns and relationships        |
| [API Reference](docs/api.md)         | All REST endpoints grouped by area               |
| [Configuration](docs/configuration.md) | Environment variables and secrets             |
| [Deployment](docs/deployment.md)      | Build, run, reset, pgAdmin, production notes    |
| [Development](docs/development.md)   | Project layout, build steps, conventions        |

The public site also publishes `robots.txt`, `sitemap.xml` and `llms.txt` from
the frontend container. The homepage is optimized for the mobile mechanic
service area in Cóbano, Santa Teresa and nearby areas.

---

## Tech stack (overview)

| Layer        | Technology                                                        |
|--------------|-------------------------------------------------------------------|
| **Backend**  | Python 3.11 + FastAPI + SQLAlchemy 2.0 + Pydantic v2              |
| **Database** | PostgreSQL 16 (persistent volume)                                 |
| **Frontend** | Static HTML + vanilla JavaScript + Tailwind CSS 3                 |
| **Server**   | nginx (static files + reverse-proxy for `/api/`)                  |
| **Auth**     | JWT access/refresh tokens, bcrypt hashing, per-IP rate limits     |
| **Realtime** | Server-Sent Events (SSE) for live updates                         |
| **i18n**     | Spanish & English (frontend `locales/` + backend `translations/`) |
