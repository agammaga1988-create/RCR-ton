# Local Development

## Requirements
- Node.js 20+
- pnpm 9.15.4+

## Install and test
```bash
pnpm install
pnpm test
```

## Run API
```bash
pnpm --filter @rcr/api start
```
The API binds to 127.0.0.1 by default. Its session endpoint is a development-only stub and refuses production session creation until Telegram authentication is implemented.

## Run Mini App preview
```bash
pnpm --filter @rcr/miniapp start
```
Open http://127.0.0.1:4173.

## Before public deployment
- Implement Telegram initData HMAC validation on the server.
- Replace in-memory sessions with PostgreSQL transactions and migrations.
- Add rate limiting, request validation, structured audit events, and monitoring.
- Configure HTTPS and Telegram BotFather Mini App URL.
- Complete TON Connect testnet integration and contract review.
- Keep production session creation and claims disabled until the release gates are met.
