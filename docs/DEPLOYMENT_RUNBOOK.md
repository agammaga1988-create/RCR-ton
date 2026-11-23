# RCR deployment runbook

This runbook is a controlled checklist. It does not itself deploy or enable the product.

## 1. Build and verify

Use Node.js 22, pnpm 9, and Acton 1.2.1 (the pinned Tolk toolchain). Install Acton using the [official installation guide](https://ton-blockchain.github.io/acton/docs/installation).

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm contracts:build
pnpm contracts:test
```

The contract build must produce the RCR Jetton artifacts before any deployment work proceeds. Preserve the exact commit SHA and build logs used for a testnet deployment.

## 2. Mini App hosting

The frontend is a static Mini App under `apps/miniapp`. Deploy only after confirming the hosting adapter/build output and that `/app.js` and `/config.js` are served with the intended security headers. Configure a public HTTPS origin. Never put Telegram bot tokens, wallet secrets, or database credentials in frontend build variables.

## 3. API hosting

Deploy `services/api` as a Node.js 22 service with:
- `NODE_ENV=production`
- `DATABASE_URL` pointing to managed PostgreSQL with TLS
- `TELEGRAM_BOT_TOKEN` stored in the host's encrypted secret manager
- `HOST=0.0.0.0`
- a restrictive `PG_POOL_MAX` appropriate to the database plan

Run database migrations as a separate release step. Restrict database network access to the API service. Configure health checks against `/health`. Do not expose a development memory-backed instance publicly.

## 4. Telegram registration

After the HTTPS Mini App URL is live:
1. Configure the bot domain with BotFather.
2. Set the Mini App URL / menu button to the exact HTTPS origin.
3. Open the app from Telegram and verify raw `initData` is sent to the API.
4. Confirm forged, stale, duplicate, and missing Telegram signatures are rejected.
5. Verify that production refuses to start session creation when Telegram auth or PostgreSQL is missing.

Never paste the bot token into GitHub source, issue comments, chat messages, or frontend configuration.

## 5. Wallet and testnet gate

Before testnet deployment, record and independently verify public addresses for:
- Jetton master administrator / deployment owner
- rewards vault owner/operator
- treasury
- marketing allocation recipient

Public addresses are not secrets. Never request or store a seed phrase or private key. Signing must happen locally in a wallet or through an audited HSM/KMS signer; no signing key is to be placed in GitHub Actions.

The owner must approve token decimals, initial mint amount, metadata URI, reward formula, complete remaining 600,000,000 RCR allocation, and the governance/renunciation policy before constructor arguments can be finalized.

## 6. Testnet deployment script

The Acton script at `contracts/tolk/scripts/deploy.tolk` defaults to zero genesis supply, requires an explicit decimals value (0–18), computes the 1,000,000,000 RCR cap in integer base units, and uses a separately supplied admin address (defaulting to the selected deployer). It does not guess token decimals or a token image.

Run locally in Acton emulation first:

```sh
cd contracts/tolk
acton build
acton wrapper --all
acton check
acton script scripts/deploy.tolk
```

Only after the local simulation is reviewed should the named command `acton run deploy-rcr-testnet` be used. That command is pinned to `--net testnet`; do not replace it with a mainnet command.

## 7. Testnet acceptance

A testnet release requires:
- successful build from a clean checkout;
- sandbox tests for mint cap, unauthorized mint, transfers, burns, wallet derivation, bounce behavior, and reward-claim replay protection;
- deployment with a test-only wallet;
- verification of master and wallet getters, code hashes, metadata, and supply;
- end-to-end Telegram Mini App session test against the testnet environment;
- documented rollback/disable procedure.

## 8. Mainnet prohibition

No mainnet deployment, token mint, paid reward, or withdrawal is authorized until the reward vault is implemented and tested, all allocations and wallet addresses are approved, a third-party smart-contract audit is complete, and the owner explicitly approves the final release.
