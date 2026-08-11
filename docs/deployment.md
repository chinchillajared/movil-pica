# Deployment

## Quick start (development / local)

```bash
# 1. Copy and edit the .env file first (see Configuration)
# 2. Build and start all services:
docker compose up -d --build
```

| Site        | URL                              |
|-------------|----------------------------------|
| Client site | http://localhost:8081/           |
| Mechanic    | http://localhost:8081/mechanic/  |
| pgAdmin     | http://localhost:8080/           |

> The first build pulls images and runs `npm install` for Tailwind, so it may
> take a couple of minutes. Subsequent starts are near-instant.

**First use of the mechanic panel:** open `/mechanic/` with no users in the
database and you will be asked to create the administrator account (name, email,
password, and optionally upload a logo). That first account has the `admin`
role.

## Rebuilding after frontend/backend changes

Frontend files (HTML, JS, CSS, Tailwind config, icons) and backend Python code
are baked into the container images. After editing them:

```bash
docker compose build frontend backend
docker compose up -d
```

> If you only changed the frontend: `docker compose build frontend
> && docker compose up -d frontend`.

## Reset (drop all data)

```bash
docker compose down -v
docker compose up -d --build
```

This wipes the database volume, so the mechanic panel will ask you to create the
admin again on next start.

## Connecting pgAdmin to the database

After pgAdmin loads:

1. Right-click **Servers** → **Register** → **Server…**
2. **General** tab: any name (e.g. `mechanic-db`).
3. **Connection** tab:
   - Host: `db`
   - Port: `5432`
   - Maintenance DB: `appointments`
   - Username: `POSTGRES_USER`
   - Password: `POSTGRES_PASSWORD`

## Production notes

- **Set strong secrets**: change `POSTGRES_PASSWORD`, `JWT_SECRET` and the
  pgAdmin password in `.env` before deploying.
- **HTTPS**: serve the site behind a TLS-terminating reverse proxy; never expose
  sensitive endpoints over plain HTTP.
- **CORS**: set `ALLOWED_ORIGINS` to the real public origin(s).
- **Gmail integration**: configure `SITE_URL` to the public base URL and set up
  the OAuth redirect URI (see below).
- **Emails without Gmail**: `EMAIL_ADDRESS` / `EMAILAPP_PASSWORD` provide a
  legacy SMTP fallback. If neither is configured, sending is skipped silently.
- **Persistent data**: the `pgdata` volume keeps the database across restarts;
  back it up regularly.

## Gmail integration (optional)

1. In the [Google Cloud Console](https://console.cloud.google.com) enable the
   **Gmail API** and create an **OAuth 2.0 Client ID** of type *Web*.
2. Add an **Authorized redirect URI** equal to
   `SITE_URL` + `/api/mechanic/gmail/callback`
   (e.g. `http://localhost:8081/api/mechanic/gmail/callback`).
3. In the mechanic panel go to **Settings → Integrations → Gmail**, enter the
   Client ID, Client Secret and the sender Gmail address, save, and click
   **Authorize with Google**.
4. Use the **Send test email** button to verify.
