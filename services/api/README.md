# RCR API

API service responsibilities:

- Verify Telegram WebApp init data on every authenticated request.
- Enforce the 24-hour session state machine using server time.
- Current: create and restore authenticated 24-hour sessions, persist them in PostgreSQL, and append audit events.
- Planned but disabled: calculate rewards from an owner-approved versioned formula and persist idempotent on-chain claims.
- No claim-registration, payout, or withdrawal endpoint is currently exposed; no endpoint accepts arbitrary reward amounts from clients.

Secrets must be supplied through deployment secret storage, never committed.
