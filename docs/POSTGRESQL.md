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

Without a database URL, the API uses in-memory sessions only in non-production development. Production fails closed with `database_not_configured`.

## Important remaining controls

Before production, use a dedicated migration role and a separate least-privilege runtime role. The migration command currently applies the initial schema; production rollout still needs a migration ledger, backup/restore rehearsal, connection monitoring, and integration tests against a managed PostgreSQL instance.
