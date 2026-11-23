# API Contract — Initial Scaffold

All responses are JSON. Production endpoints require verified Telegram WebApp init data; client-supplied user IDs are never accepted as identity.

## GET /health
Development health probe.

## GET /config
Returns public, non-secret configuration. Claims are disabled by default.

## POST /sessions
Development-only stub. In production it returns 503 until Telegram init-data verification, persistence, abuse controls, and audit logging are implemented.

Example development request:
```json
{ "userId": "local-test-user" }
```

Do not expose the development identity stub on a public deployment.
