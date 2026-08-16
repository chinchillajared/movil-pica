# Development

## Project layout

```
.
├── docker-compose.yml           # Services: db, pgadmin, backend, frontend
├── .env                         # Environment variable configuration
├── README.md                    # User-facing overview (features + usage)
├── docs/                        # Technical documentation (this folder)
│
├── backend/                     # FastAPI Python service
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── translations/            # Server-side i18n JSON files (es.json, en.json)
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
│           ├── public.py        # Public endpoints (appointments, schedule, announcements, site settings)
│           ├── client_auth.py   # Client register / login / refresh / me / vehicles / appointments / repairs
│           ├── mechanic.py      # Panel auth, users, reminders, gmail, clients, appointments, settings, vehicles
│           ├── events.py        # SSE stream
│           └── i18n_router.py   # Translation file endpoint
│
└── frontend/                    # Static site served by nginx
    ├── Dockerfile               # Multi-stage: builds Tailwind, then copies to nginx
    ├── nginx.conf               # Reverse-proxy /api/, static file serving
    ├── package.json             # Tailwind CSS + PostCSS dev dependencies
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── src/input.css            # Tailwind source entry (shared component classes)
    ├── locales/                 # Client-side i18n JSON (ES / EN)
    ├── icons/                   # Static SVG icons served at /icons/
    ├── shared/
    │   ├── api.js               # Fetch wrapper — auto-prepends /api/, JSON parse
    │   ├── auth.js              # Client header + login/register modal (public site)
    │   ├── i18n.js              # Client-side translation engine
    │   └── styles.css           # Built Tailwind output
    ├── user/                    # User-facing pages
     │   ├── index.html           # Home (schedule / status / my garage)
     │   ├── account.html         # Authenticated client entry point
    │   ├── schedule.html        # 3-step appointment wizard
    │   ├── status.html          # Appointment lookup form + result card
    │   ├── vehicles.html        # My vehicles (register / edit / remove)
    │   ├── appointments.html    # My appointments (live list)
    │   ├── repairs.html         # My vehicles' service history
    │   └── app.js               # User pages logic (per PAGE dispatch)
    └── mechanic/
        ├── index.html           # Login / first-run admin setup
        ├── dashboard.html       # Calendar, vehicles, clients, announcements, users, settings
        ├── create.html          # Manual appointment creation (guest / registered client)
        └── app.js               # Mechanic panel logic (per PAGE dispatch)
```

## Build steps

### Tailwind CSS

```bash
cd frontend
npm install        # once
npm run build      # compiles src/input.css -> shared/styles.css
npm run watch      # rebuild on change (development)
```

### Docker images

```bash
docker compose build        # build backend + frontend
docker compose up -d        # start services
```

## Conventions

- **Backend:** Python (FastAPI). Use Pydantic models in `schemas.py`, CRUD
  helpers in `crud.py`, and **parameterized queries / ORM only** (never string
  concatenation). Add rate limiting to new endpoints (`rate_limit(...)`).
- **Frontend:** vanilla JavaScript, no frameworks. Page-specific logic lives in
  `user/app.js` and `mechanic/app.js` and dispatches on `window.PAGE`.
- **UI:** use Tailwind utility classes and the shared component classes defined
  in `frontend/src/input.css` (`btn-primary`, `btn-secondary`, `card`,
  `field-input`, `badge-*`, …). Keep the design consistent across pages.
- **Dialogs:** never use native `alert()`/`confirm()`/`prompt()` for
  user-facing messages. Use the shared styled modals `showMessage()` /
  `showConfirm()` from `frontend/shared/api.js`.
- **i18n:** all user-facing text uses `data-i18n` attributes / `t()` keys. Keys
  must exist in **both** `frontend/locales/es.json` and `en.json` (and in
  `backend/translations/` for API error messages).
- **Security:** never commit secrets (`.env`); use bcrypt for passwords; validate
  and sanitize all user input client- and server-side.
- **Icons:** static SVGs live in `frontend/icons/` and are referenced as
  `<img src="/icons/...">`. To change an icon, edit the SVG and rebuild the
  frontend container.

## Visual system

The current interface uses a restrained automotive visual language shared by the
public site and the mechanic panel:

| Token | Value | Use |
|-------|-------|-----|
| Navy | `#0b1628` | Public header, hero, mechanic navigation |
| Navy blue | `#1c3558` | High-contrast controls on dark headers |
| Lime | `#c7f36a` | Primary actions and highlights on dark surfaces |
| Brand blue | `#1d4ed8` | Primary actions on light surfaces and focus accents |
| Page background | `#f6f8fb` | Public page and application background |
| Border | `#e2e8f0` | Cards, inputs, dividers and information tags |

### Components

- `.btn-primary` is the main action. Use it for booking, saving and continuing.
  On dark hero or header surfaces it is intentionally overridden to lime with
  navy text.
- `.btn-secondary` is for navigation, cancel and secondary actions. It must keep
  a visible border on both light and dark surfaces.
- `.btn-danger` is reserved for destructive operations.
- `.field-input` is the shared input/select style: white surface, slate border,
  rounded corners and a visible blue focus ring.
- `.card`, `.page-card`, `.booking-shell` and `.service-card` define white
  surfaces with thin borders, rounded corners and restrained shadows.
- Information values use rounded tags: bold label, regular value, white
  background and a thin border. Escape dynamic labels and values before adding
  them to the DOM.
- Dark-header configuration buttons use a `#1c3558` background, a light border
  and an inverted white gear icon so the control remains visible at a glance.

### Public imagery and services

Images are managed from the mechanic panel site settings and returned by
`GET /api/site/settings` as `background_images`. The public homepage uses those
images for its hero and service cards, with an icon fallback when no image has
been uploaded. The same response includes `logo_data_url`, `logo_width` and
`logo_height`. The public branding loader renders the logo over the navy
`#0b1628` background and replaces white/transparent background pixels with that
brand color. Logo dimensions are persisted in pixels and validated by the API
(`logo_width`: 80–320; `logo_height`: 32–120).

Homepage service cards do not display prices, while opening a service in the
client service history shows its labor, parts, currency, amounts, and totals.
Price rows remain available to the mechanic panel and persistence.

The public homepage consumes persisted `homepage_content` and
`homepage_layout` values when present. The mechanic `Personalizar sitio` tab
opens the direct website editor, where service images are uploaded directly
from the computer, along with their text, section visibility/order, and
supported sizes. Image indexes are internal storage details and are not shown
in the editor UI.

## Verifying changes

- Rebuild Tailwind after any class changes: `npm run build` in `frontend/`.
- Rebuild the Docker containers to see frontend or backend changes:
  `docker compose build && docker compose up -d`.
- Check that i18n keys exist in both `es.json` and `en.json`.
- When changing `site_settings`, update the SQLAlchemy model, Pydantic schemas,
  startup `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` setup, CRUD functions, and
  both public and mechanic site-settings responses.
