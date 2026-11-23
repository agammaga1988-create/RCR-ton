# RCR Railway deployment

## Provisioned testnet infrastructure

The Railway workspace is connected. The following resources were provisioned in the `testnet` environment:

- Project: `RCR GRAM`
- PostgreSQL service: `Postgres` (persistent 500 MB volume)
- API service: `rcr-app` — https://rcr-app-testnet.up.railway.app
- Telegram Mini App service: `rcr-miniapp` — https://rcr-miniapp-testnet.up.railway.app

The API and Mini App are configured from the repository root so pnpm workspace dependencies resolve. Both services use the repository's `main` branch. PostgreSQL migrations 001 and 008–011 were applied by the API pre-deploy migration command. Railway healthchecks reported both app services online after deployment.

## API service

- Build/install command: `corepack enable && pnpm install --frozen-lockfile`
- Pre-deploy command: `pnpm --filter @rcr/api migrate`
- Start command: `pnpm --filter @rcr/api start`
- Healthcheck: `/health`
- Runtime variables: `HOST=0.0.0.0`, `NODE_ENV=production`, private PostgreSQL `DATABASE_URL`, and `RCR_PUBLIC_URL=https://rcr-miniapp-testnet.up.railway.app`.
- Public origin: `https://rcr-app-testnet.up.railway.app`

## Mini App service

- Build/install command: `corepack enable && pnpm install --frozen-lockfile`
- Start command: `pnpm --filter @rcr/miniapp start`
- Healthcheck: `/health`
- Runtime variables:
  - `HOST=0.0.0.0`
  - `RCR_PUBLIC_URL=https://rcr-miniapp-testnet.up.railway.app`
  - `RCR_API_BASE=https://rcr-app-testnet.up.railway.app`
- Public origin: `https://rcr-miniapp-testnet.up.railway.app`
- The Mini App server derives `/tonconnect-manifest.json` and `/rcr-icon.png` from the configured HTTPS origin.

## Telegram bot connection — pending owner credential

The API service does not currently have `TELEGRAM_BOT_TOKEN`. Add it only through Railway's encrypted variable interface after creating/selecting the bot in BotFather. Never commit or paste the token into source code, issues, logs, or this document. Once configured, verify Telegram init-data validation and session creation.

## On-chain release boundary

Hosting the API and Mini App does not deploy the RCR Jetton or MiningIssuer contracts. The current token contract deployment scripts are Mainnet-specific and require the owner deployment wallet to sign locally through Acton. They enforce zero genesis supply, 9 decimals, a 1,000,000,000 RCR maximum supply, and a paused MiningIssuer. The public wallet addresses in the deployment scripts are configuration only; they do not grant signing capability.

Do not activate rewards, claims, payouts, withdrawals, or trading based only on successful hosting. Those flows remain disabled until the contract deployment, wallet authorization, audited reward configuration, and release checks are complete. No seed phrase or private key is needed by the hosted application.

## Telegram bot launcher

A dedicated `rcr-telegram-bot` Railway service has been created from this repository. It runs `pnpm --filter @rcr/telegram-bot start`, uses the repository root for pnpm workspace installation, and has `RCR_MINIAPP_URL=https://rcr-miniapp-testnet.up.railway.app`. It intentionally has no bot token yet and therefore must not be considered active. Create the bot with @BotFather, configure the Mini App domain, then add the resulting `TELEGRAM_BOT_TOKEN` only in this service's encrypted Railway variables. After that, redeploy and verify the service logs report the bot started. The bot uses long polling; only one instance may poll this token, and no webhook should be active at the same time.

The bot launcher currently points to the hosted Testnet Mini App. Mainnet wallet/network settings and token actions remain disabled pending audited contract deployment and release approval.
