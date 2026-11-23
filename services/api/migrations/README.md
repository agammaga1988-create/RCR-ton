# Database migrations

Migrations target PostgreSQL 16+. Apply in numeric order using a dedicated migration role. The runtime application role should receive only the minimum required DML grants; it must not own the schema or audit table.

The initial migration defines identity, 24-hour sessions, idempotent claim uniqueness, and append-only audit history. Production deployment must add a migration runner, transactional integration tests, backups, and role-specific grants before enabling writes.
