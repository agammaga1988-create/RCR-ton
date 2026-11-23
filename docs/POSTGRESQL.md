# PostgreSQL session persistence

The API uses PostgreSQL whenever `DATABASE_URL` is configured. Session creation runs in a transaction:

1. Upsert the verified Telegram user.
2. Check for an active, unexpired session.
3. Mark expired active sessions completed.
4. Insert a new 24-hour session.
5. Append a `session.started` audit event.
6. Commit atomically.

The partial unique index `one_active_session_per_user` is the final concurrency guard. A duplicate active session returns HTTP 409.

## Configure

Set `DATABASE_URL` in the API deployment secret store. Optionally set `PG_POOL_MAX` and `PGSSL=require` when the database provider requires TLS with a trusted certificate.

Run `pnpm --filter @rcr/api migrate` after provisioning PostgreSQL 16+.

The migration runner takes a PostgreSQL advisory lock and records successful versions in `schema_migrations`. Re-running an applied migration is a no-op. The initial SQL remains idempotent to support safe recovery if the schema transaction commits but the version record cannot be written.

Without a database URL, the API uses in-memory sessions only in non-production development. Production session creation fails closed with `database_not_configured`.

## Production database controls

- Use a dedicated migration role for DDL and a separate least-privilege runtime role.
- Grant the runtime role only the required SELECT/INSERT/UPDATE privileges; do not grant schema ownership or audit-row mutation.
- Keep PostgreSQL TLS certificate validation enabled.
- Configure automated backups, point-in-time recovery, connection monitoring, and alerting.
- Rehearse backup restoration and migration rollback/recovery before launch.
- Run integration and concurrency tests against PostgreSQL 16+ before enabling claims.

The migration runner and schema are versioned, but managed-database integration tests, backup/restore rehearsal, monitoring, and an independent security review remain release gates.
