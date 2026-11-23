# RCR API

API service responsibilities:

- Verify Telegram WebApp init data on every authenticated request.
- Enforce the 24-hour session state machine using server time.
- Calculate rewards from a versioned server-side formula.
- Persist idempotent claims and append-only audit events.
- Expose no endpoint that accepts arbitrary reward amounts from clients.

Secrets must be supplied through deployment secret storage, never committed.
