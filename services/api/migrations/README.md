# Database migrations

Migrations are numbered SQL files named `NNN_description.sql` and are applied in numeric order by `src/migrate.js`. The runner acquires a PostgreSQL advisory lock, executes each unapplied migration and its `schema_migrations` record in the same transaction, and safely skips versions already recorded. Do not put explicit `BEGIN`/`COMMIT` statements inside migration files; the runner owns transaction boundaries.

Migrations target PostgreSQL 16+. Apply them using a dedicated migration role. The runtime application role should receive only minimum required DML grants; it must not own the schema or audit table.

The initial migration defines identity, 24-hour sessions, idempotent claim uniqueness, and append-only audit history. Migration 008 makes the reward formula version nullable because no reward rate/formula has been approved. Session creation must not imply a reward calculation version before that decision is made. Migration 009 adds a unique monotonic BIGINT chain claim nonce to each reward claim, mapping PostgreSQL claim records to the MiningIssuer contract's uint64 query IDs.
Migration 010 adds a disabled-by-default reward policy singleton and an idempotent reward ledger keyed by earning session. Ledger accounting facts are immutable, deletes are rejected, and state changes are constrained. It is schema groundwork only: no formula, rate, decimals, cap value, claim endpoint, or payout worker is approved or enabled by this migration.

Production deployment still requires managed database operations, least-privilege grants, backups, and restore rehearsal.
