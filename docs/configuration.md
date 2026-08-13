# Configuration

All configuration comes from environment variables in the `.env` file at the
project root. Copy `.env.example` to `.env` and replace every placeholder before
running Compose. `docker-compose.yml` intentionally fails if a required value is
missing; it does not use insecure fallback passwords.

## Environment variables

| Variable                  | Required       | Description                                  |
|---------------------------|----------------|----------------------------------------------|
| `POSTGRES_USER`           | Yes            | Postgres role                                |
| `POSTGRES_PASSWORD`       | Yes            | Postgres password                            |
| `POSTGRES_DB`             | Yes            | Database name                                |
| `PGADMIN_DEFAULT_EMAIL`   | Yes            | pgAdmin login email                          |
| `PGADMIN_DEFAULT_PASSWORD`| Yes            | pgAdmin login password                       |
| `FRONTEND_PORT`           | Yes            | Host port for the user/mechanic site         |
| `BACKEND_PORT`            | Yes            | Host port for the FastAPI backend            |
| `ALLOWED_ORIGINS`         | Yes            | Comma-separated CORS allow-list              |
| `SITE_URL`                | Yes            | Public base URL used for Gmail OAuth         |
| `JWT_SECRET`              | Yes            | Secret used to sign JWT tokens               |
| `ACCESS_TOKEN_MINUTES`    | `60`           | Access token lifetime (minutes)             |
| `REFRESH_TOKEN_DAYS`      | `30`           | Refresh token lifetime (days)               |
| `EMAIL_ADDRESS`           | No             | Legacy SMTP sender address (fallback)       |
| `EMAILAPP_PASSWORD`       | No             | Legacy SMTP app password (fallback)         |
| `RATE_LIMIT_MAX`          | `20`           | Max requests per window per IP              |
| `RATE_LIMIT_WINDOW`       | `60`           | Rate-limit window (seconds)                 |

## Secrets & security

> **Use unique values for `POSTGRES_PASSWORD`, `JWT_SECRET`, and the pgAdmin
> password before deploying anywhere real.**

- `JWT_SECRET` signs all tokens — a weak/default value lets an attacker forge
  sessions.
- `POSTGRES_PASSWORD` protects the database.
- The `.env` file is **not** committed to version control (see `.gitignore`).
- The mechanic panel does **not** use a shared password: accounts are created on
  first run and managed by the admin.

## First start

```bash
cp .env.example .env
docker compose up -d --build
```

If `.env` is missing or a required variable is empty, Compose stops before
creating containers and reports the missing variable. Changing a Postgres
password in `.env` does not change an existing database volume; plan a database
password migration separately before changing it on an existing installation.

## CORS

`ALLOWED_ORIGINS` is a comma-separated list. In production include the real
public origin(s) of the site.
