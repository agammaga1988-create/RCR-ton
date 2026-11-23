# RCR Telegram Bot

A minimal Telegram Bot API long-polling service. It responds to /start with an HTTPS Mini App launch button and /help with wallet safety guidance.

## Railway

Deploy this folder as a service from the repository root:

- Install/build: `corepack enable && pnpm install --frozen-lockfile`
- Start: `pnpm --filter @rcr/telegram-bot start`
- Required secret: `TELEGRAM_BOT_TOKEN` (BotFather token; Railway secret variable only)
- Required public variable: `RCR_MINIAPP_URL=https://rcr-miniapp-testnet.up.railway.app`

Only one polling instance may run for a bot token. Do not run a second poller or configure a webhook at the same time. The service deletes an existing webhook before polling; do not use it if another production webhook is already active.

## Create bot

In Telegram open @BotFather, run /newbot, choose the display name and unique username, and store the token directly in Railway's encrypted variable editor. Never commit or paste the token into chat. Configure the Mini App domain in BotFather to match the public HTTPS domain.

The bot only launches the Mini App. All identity validation remains server-side in the API using Telegram initData and the bot token. It does not custody funds, request seed phrases, sign transactions, or enable rewards/withdrawals.
