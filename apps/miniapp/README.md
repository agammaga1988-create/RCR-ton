# RCR Telegram Mini App

A mobile-first Telegram WebApp for starting 24-hour RCR earning sessions.

## Run locally

```bash
pnpm install
pnpm --filter @rcr/miniapp start
```

The server listens on `127.0.0.1:4173` by default. Set `HOST` and `PORT` as needed. The Mini App calls `/sessions` on its own origin. In deployment, route `/sessions` to the API through a same-origin reverse proxy; cross-origin API calls are intentionally not enabled.

## Telegram setup

1. Create/configure the bot with BotFather and set the bot token only in the API secret store.
2. Configure the Mini App URL as a public HTTPS URL in Telegram.
3. Route `POST /sessions` from the Mini App origin to the API.
4. The client sends Telegram's raw `initData`; the API validates its HMAC and timestamp. Client-supplied user IDs are never used for production identity.
5. Keep the bot token out of this frontend and out of every browser bundle.

## Security boundaries

- No seed phrase/private key fields or custody.
- No wallet connection or token claim buttons yet.
- No rewards/withdrawals are represented as available.
- CSP allows Telegram's WebApp SDK and Telegram's embedding origins; configure a stricter API `connect-src` allowlist for the production deployment.
- Session countdown is a client display only; the API/database timestamp remains authoritative.
- Telegram init data is accepted for 15 minutes; users should reopen the Mini App to obtain fresh signed data.

Run tests with `pnpm --filter @rcr/miniapp test`.
