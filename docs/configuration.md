# Configuration

All configuration comes from environment variables (see the `.env` file at the
project root). `docker-compose.yml` reads them to configure the containers.

## Environment variables

| Variable                  | Default        | Description                                  |
|---------------------------|----------------|----------------------------------------------|
| `POSTGRES_USER`           | `mechanic`     | Postgres role                                |
| `POSTGRES_PASSWORD`       | `changeme`     | Postgres password                            |
| `POSTGRES_DB`             | `appointments` | Database name                                |
| `PGADMIN_DEFAULT_EMAIL`   | `admin@local.com` | pgAdmin login email                        |
| `PGADMIN_DEFAULT_PASSWORD`| `changeme`     | pgAdmin login password                       |
| `PGADMIN_PORT`            | `8080`         | Host port for pgAdmin                        |
| `FRONTEND_PORT`           | `8081`         | Host port for the user/mechanic site         |
| `ALLOWED_ORIGINS`         | `http://localhost:8081,http://localhost:8080` | CORS allow-list |
| `SITE_URL`                | `http://localhost:8081` | Public base URL (used for the Gmail OAuth redirect) |
| `JWT_SECRET`              | `changeme-secret-key` | Secret used to sign JWT tokens            |
| `ACCESS_TOKEN_MINUTES`    | `60`           | Access token lifetime (minutes)             |
| `REFRESH_TOKEN_DAYS`      | `30`           | Refresh token lifetime (days)               |
| `EMAIL_ADDRESS`           | *(empty)*      | Legacy SMTP sender address (fallback)       |
| `EMAILAPP_PASSWORD`       | *(empty)*      | Legacy SMTP app password (fallback)         |
| `RATE_LIMIT_MAX`          | `20`           | Max requests per window per IP              |
| `RATE_LIMIT_WINDOW`       | `60`           | Rate-limit window (seconds)                 |

## Secrets & security

> **Change `POSTGRES_PASSWORD`, `JWT_SECRET`, and the pgAdmin password before
> deploying anywhere real.**

- `JWT_SECRET` signs all tokens — a weak/default value lets an attacker forge
  sessions.
- `POSTGRES_PASSWORD` protects the database.
- The `.env` file is **not** committed to version control (see `.gitignore`).
- The mechanic panel does **not** use a shared password: accounts are created on
  first run and managed by the admin.

## CORS

`ALLOWED_ORIGINS` is a comma-separated list. In production include the real
public origin(s) of the site.
