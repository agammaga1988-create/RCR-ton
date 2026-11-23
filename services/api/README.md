# RCR API

API service responsibilities:

- Verify Telegram WebApp init data on every authenticated request.
- Enforce the 24-hour session state machine using server time.
- Current: create and restore authenticated 24-hour sessions, persist them in PostgreSQL, and append audit events.
- Planned but disabled: calculate rewards from an owner-approved versioned formula and persist idempotent on-chain claims.
- Database migration 010 now provides a disabled-by-default policy record and append-only-style reward ledger safeguards; this is not an active reward engine and no ledger writer or payout worker is exposed.
- No claim-registration, payout, or withdrawal endpoint is currently exposed; no endpoint accepts arbitrary reward amounts from clients.

Secrets must be supplied through deployment secret storage, never committed.

## Production configuration

Required: `NODE_ENV=production`, `DATABASE_URL` (TLS PostgreSQL), `TELEGRAM_BOT_TOKEN` (secret manager only), `HOST=0.0.0.0`, and `RCR_PUBLIC_URL` set to the exact Mini App HTTPS origin. The API handles CORS preflight only for that exact origin; it does not use wildcard CORS. The Mini App host sets `RCR_API_BASE` to this API's HTTPS origin.
