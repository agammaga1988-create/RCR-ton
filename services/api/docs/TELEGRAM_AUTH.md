# Telegram Mini App authentication

The API verifies Telegram's signed `initData` on the server before deriving a user identity.

## Configuration

Set `TELEGRAM_BOT_TOKEN` as a deployment secret. Never commit the real bot token, expose it to the Mini App, or accept a Telegram user ID as proof of identity.

## Session request

Send:

```json
{ "initData": "<exact Telegram.WebApp.initData string>" }
```

The API validates the HMAC-SHA-256 signature using Telegram's `WebAppData` derivation, rejects duplicate fields, checks `auth_date` freshness (24 hours maximum, with 30 seconds of future clock skew), and reads the user ID only from the signed `user` field.

When `TELEGRAM_BOT_TOKEN` is absent, a caller-supplied `userId` is accepted only outside production as a local-development stub. In production, session creation fails closed until the token is configured and valid signed `initData` is supplied.

## Remaining production work

- Replace in-memory sessions with transactional PostgreSQL persistence and enforce one active session per user in the database.
- Add replay/idempotency handling and rate limiting.
- Configure HTTPS, strict origin policy, monitoring, and secret rotation.
- Add integration tests against the deployed Telegram Mini App.
- Keep reward claims and all blockchain transfers disabled until contract review and explicit owner approval.
