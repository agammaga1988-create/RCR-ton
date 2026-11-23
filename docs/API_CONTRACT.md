# API Contract — Current

All API responses are JSON. Production session creation requires valid Telegram WebApp init data; client-supplied user IDs are never accepted as production identity.

## GET /health

Returns a basic process health response. It does not prove database readiness.

## GET /config

Returns non-secret public configuration: token symbol, session duration, network status, claims flag, and persistence mode. No credentials or wallet data are returned.

## POST /sessions

Starts one 24-hour earning session for the verified Telegram user.

Request:
```json
{ "initData": "<raw Telegram.WebApp.initData>" }
```

Production requirements:
- `TELEGRAM_BOT_TOKEN` configured in the API secret store.
- `DATABASE_URL` configured and schema migrations applied.
- Telegram init data HMAC valid and no older than 15 minutes.
- One active session maximum per Telegram user.

Responses:
- `201` session created.
- `401` invalid/expired Telegram authentication.
- `409` an active session already exists.
- `413` body too large.
- `415` unsupported content type.
- `429` process-local rate limit exceeded.
- `503` required production configuration missing.
- `500` generic internal error.

## Important limitations

- Session reward remains null; no reward amount is promised or calculated by this endpoint.
- Claims and withdrawals are disabled.
- The Mini App must call the API through a same-origin reverse proxy. Cross-origin browser API calls are not enabled.
- A client countdown is display-only; server/database timestamps are authoritative.
- `GET /health` is liveness only, not readiness.
