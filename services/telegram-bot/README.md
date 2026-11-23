# RCR Telegram Bot

Official Telegram entry point for the RCR on TON testnet Mini App.

## Included bot experience

- `/start` and `/menu`: welcome screen with interactive feature menu.
- `/app`: opens the Telegram Mini App using a Telegram Web App button.
- `/earn`: explains the 24-hour session flow and its current limitations.
- `/status`: checks the public Mini App health endpoint.
- `/wallet`: directs wallet connection to TON Connect inside the Mini App.
- `/rules`: displays anti-phishing and non-custodial safety rules.
- `/help`: lists all commands.
- Inline callback menu, Telegram command registration, bot profile descriptions, and persistent Mini App menu button.

The bot does not fabricate balances, calculate rewards, or promise payouts. Session eligibility and state remain server-authoritative in the API. Token claims and withdrawals are disabled until reward accounting, contracts, security review, and owner approval are complete.

## Railway configuration

- Root directory: repository root `/`
- Build: `corepack enable && pnpm install --frozen-lockfile`
- Start: `pnpm --filter @rcr/telegram-bot start`
- Secret: `TELEGRAM_BOT_TOKEN` (token from BotFather; keep it in Railway secret variables only)
- Public variable: `RCR_MINIAPP_URL` (public HTTPS URL of the RCR Mini App)

Only one polling instance may run for a bot token. The service removes an existing webhook before long polling. Do not run a second poller or configure a webhook at the same time.

## Bot creation and ownership

The Telegram bot identity itself must be created by its owner with @BotFather using `/newbot`. A Telegram Bot API token cannot create a bot identity. Once that identity exists, placing its token in Railway lets this service register commands, set the profile text, install the Mini App menu button, and respond to users.

Never request or store seed phrases or private keys. Configure the Mini App domain with @BotFather to match the HTTPS domain.
