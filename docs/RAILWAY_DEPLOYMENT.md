# RCR Railway deployment plan

This is a hosting runbook, not a claim that services have been deployed. Connect the Railway workspace before provisioning resources.

## Services

Create one Railway project with:
1. PostgreSQL service.
2. API service from this repository.
3. Mini App service from this repository.

Use the repository root for both Node services so pnpm workspace dependencies resolve. Use Node.js 22 and pnpm 9.15.4.

### API service

- Build/install command: `corepack enable && pnpm install --frozen-lockfile`
- Pre-deploy/release command: `pnpm --filter @rcr/api migrate`
- Start command: `pnpm --filter @rcr/api start`
- Set `HOST=0.0.0.0`, `NODE_ENV=production`.
- Set `DATABASE_URL` from the Railway PostgreSQL service's private connection URL.
- Set `TELEGRAM_BOT_TOKEN` using Railway's encrypted variable interface only.
- Set `RCR_PUBLIC_URL` to the Mini App's exact public HTTPS origin (no trailing path).
- Expose the service on HTTPS and verify `/health`.

### Mini App service

- Build/install command: `corepack enable && pnpm install --frozen-lockfile`
- Start command: `pnpm --filter @rcr/miniapp start`
- Set `HOST=0.0.0.0`.
- Set `RCR_PUBLIC_URL` to this service's exact public HTTPS origin.
- Set `RCR_API_BASE` to the API service's public HTTPS origin.
- Verify `/`, `/config.js`, `/tonconnect-manifest.json`, and `/rcr-icon.png` over HTTPS.

After both services have stable HTTPS domains, update the API's `RCR_PUBLIC_URL` to exactly match the Mini App origin. The manifest must reference the final Mini App origin and its icon.

## Telegram

After the Mini App and API are live:
1. Create or select the Telegram bot in BotFather.
2. Configure the Mini App URL and menu button to the Mini App HTTPS origin.
3. Store the bot token only as the API service's encrypted `TELEGRAM_BOT_TOKEN` variable.
4. Open the Mini App inside Telegram and verify signed init data, session creation, and restoration.

No bot token is stored in this repository. Do not paste it into chat, issues, build logs, or client-side variables.

## Release boundary

The currently implemented API supports authenticated 24-hour sessions only. Reward calculation, claim registration, payouts, and withdrawals remain disabled. TON Connect in the Mini App is testnet-only. Hosting the app does not deploy the token contracts or enable token transfers/rewards.
