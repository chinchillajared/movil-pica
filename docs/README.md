# Technical Documentation

This folder contains the technical documentation for the **Mecánico Móvil**
appointment scheduler. For an end-user overview (features and how to use the
app) see the [project README](../README.md).

## Contents

| Document                                              | Contents                                                        |
|-------------------------------------------------------|-----------------------------------------------------------------|
| [Architecture](architecture.md)                       | System components, request flow, authentication, realtime, key design decisions |
| [Database](database.md)                               | Engine, connection, tables, columns and relationships           |
| [API Reference](api.md)                               | Every REST endpoint grouped by area (public, client, mechanic, realtime) |
| [Configuration](configuration.md)                     | Environment variables, defaults and secrets                     |
| [Deployment](deployment.md)                           | Build, run, reset, pgAdmin and production notes                 |
| [Development](development.md)                         | Project layout, build steps and code conventions                |

## Quick map

- **Docker Compose services:** `db`, `pgadmin`, `backend`, `frontend` →
  see [Architecture](architecture.md).
- **How to configure the app:** see [Configuration](configuration.md).
- **How to run / deploy:** see [Deployment](deployment.md).
- **Where everything lives:** see [Development](development.md).
