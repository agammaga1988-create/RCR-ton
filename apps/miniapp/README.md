# RCR Telegram Mini App

A mobile-first Telegram WebApp for starting 24-hour RCR earning sessions and connecting a TON wallet on testnet.

## Run locally

```bash
pnpm install
pnpm --filter @rcr/miniapp start
```

The server listens on `127.0.0.1:4173` by default. Set `HOST` and `PORT` as needed. For a separate local API, set `RCR_API_BASE`; for wallet connection, set `RCR_PUBLIC_URL` to a public HTTPS origin. The manifest endpoint intentionally returns 503 until that HTTPS origin is configured.

## Cloudflare Pages

- Project root: `apps/miniapp`
- Build command: empty
- Build output directory: `.`
- Pages Functions are constrained by `_routes.json` to runtime config, TON Connect manifest and icon routes.
- Set `RCR_PUBLIC_URL` to the exact public HTTPS origin.
- Set `RCR_API_BASE` to the API's HTTPS origin.
- Set the API service's `RCR_PUBLIC_URL` to the same Mini App origin for exact-origin CORS.

The manifest is publicly served without authentication and references a 180×180 PNG icon. Verify `/config.js`, `/tonconnect-manifest.json`, and `/rcr-icon.png` after deployment.

## Telegram setup

1. Create/configure the bot with BotFather and set the bot token only in the API secret store.
2. Configure the Mini App URL as a public HTTPS URL in Telegram.
3. Set `RCR_API_BASE` on the Mini App host and the exact matching `RCR_PUBLIC_URL` on the API.
4. The client sends Telegram's raw `initData`; the API validates its HMAC and timestamp. Client-supplied user IDs are never used for production identity.
5. Keep the bot token out of this frontend and out of every browser bundle.

## TON Connect behavior

- The pinned `@tonconnect/ui` CDN bundle is initialized only when the public HTTPS manifest is configured.
- Wallet network is restricted to TON testnet (`-3`).
- TON Connect telemetry is disabled.
- The app displays the connected public address locally; it does not send it to the API.
- No transaction signing, token transfers, claims, or withdrawals are enabled.

## Security boundaries

- No seed phrase/private-key fields or custody.
- MiningIssuer is deployed paused; no reward formula or eligibility policy is enabled.
- Session countdown is a client display only; the API/database timestamp remains authoritative.
- Telegram init data is accepted for 15 minutes; users should reopen the Mini App to obtain fresh signed data.
- CSP currently permits HTTPS connections needed by wallet bridges; review and narrow the provider allowlist during the production security review.

Run tests with `pnpm --filter @rcr/miniapp test`.
