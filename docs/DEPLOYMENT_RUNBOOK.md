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

## 2A. Cloudflare Pages configuration

For the static Mini App, set the Cloudflare Pages project root directory to `apps/miniapp`, leave the build command empty, and use `.` as the build output directory. The `functions/[[path]].js` catch-all is constrained by `_routes.json` to `/config.js`, `/tonconnect-manifest.json`, and `/rcr-icon.png`; `_headers` applies the Mini App CSP and browser security headers.

Set these Pages environment variables for production:
- `RCR_PUBLIC_URL` = the exact public HTTPS origin, e.g. `https://rcr.example` (no path).
- `RCR_API_BASE` = the API's public HTTPS origin, e.g. `https://api.rcr.example`.

The API service must set `RCR_PUBLIC_URL` to the exact same Mini App origin for strict CORS. Verify `/config.js`, `/tonconnect-manifest.json`, and `/rcr-icon.png` after deployment. The manifest must be publicly accessible over HTTPS, without auth or proxy challenges, and its icon must be a 180×180 PNG.

## 3. API hosting

Deploy `services/api` as a Node.js 22 service with:
- `NODE_ENV=production`
- `DATABASE_URL` pointing to managed PostgreSQL with TLS
- `TELEGRAM_BOT_TOKEN` stored in the host's encrypted secret manager
- `RCR_PUBLIC_URL` set to the exact Mini App HTTPS origin (strict CORS allowlist)
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

## 5. Owner-provided wallet details

The owner supplied the following public TON addresses and confirmed 9 decimals on 2026-11-23:

- Proposed deployment wallet: `UQDvqZ56PiYwhyyUshMJR4VGyUEWogLhhnQKsaMo0XWzIoZv`
- Proposed RCR administrator wallet: `UQC-0SBzMfz36M1rqf3eik4igzLQBHcIItqzbWVIBd_1bsEY`
- Confirmed token precision: **9 decimals**.

These are recorded as owner-provided values only; this repository has not independently verified wallet ownership or on-chain status. Both supplied friendly addresses use the Mainnet-style `UQ` prefix. They must not be passed to the testnet deployment command. Before any Mainnet transaction, verify both addresses on TON Mainnet using an independent wallet/address display and confirm the intended roles.

Public addresses are not secrets. Never request or store a seed phrase or private key. Signing must happen locally in the owner's wallet or through an audited HSM/KMS signer; no signing key is to be placed in GitHub Actions. A public address alone cannot authorize a deployment or admin transaction.

## 6. Testnet wallet and deployment gate

The checked-in Acton script is explicitly testnet-only. Use separate testnet addresses and a testnet-funded signer for rehearsal; do not substitute the Mainnet addresses recorded above.

Before testnet deployment, record and independently verify public addresses for:
- Jetton master administrator / deployment owner
- rewards vault owner/operator
- treasury
- marketing allocation recipient

The owner must approve the initial mint amount (currently zero), metadata URI, reward formula, complete remaining 600,000,000 RCR allocation, and governance/renunciation policy before constructor arguments are finalized. The 9-decimal precision is confirmed.

## 7. Testnet deployment script

The Acton script at `contracts/tolk/scripts/deploy.tolk` deploys both the TEP-74 Jetton master and the separate MiningIssuer, defaults genesis supply to zero, fixes precision at 9 decimals, and enforces 600,000,000 public / 400,000,000 mining lifetime caps. Select `JETTON_DEPLOYER` and `JETTON_ADMIN_WALLET`; optionally set `RCR_MINING_OPERATOR_ADDRESS` (defaults to the admin wallet). The admin wallet signs the one-time MiningIssuer authorization. The MiningIssuer is deployed paused, so no mining claims can be issued until the reward formula and eligibility policy are explicitly approved and the admin resumes it.

Run locally in Acton emulation first:

```sh
cd contracts/tolk
acton build
acton wrapper --all
acton check
acton script scripts/deploy.tolk
```

Only after the local simulation is reviewed should the named command `acton run deploy-rcr-testnet` be used. That command is pinned to `--net testnet`; do not replace it with a mainnet command.

## 8. Testnet acceptance

A testnet release requires:
- successful build from a clean checkout;
- sandbox tests for mint cap, unauthorized mint, transfers, burns, wallet derivation, bounce behavior, and reward-claim replay protection;
- deployment with a test-only wallet;
- verification of master and wallet getters, code hashes, metadata, and supply;
- end-to-end Telegram Mini App session test against the testnet environment;
- documented rollback/disable procedure.

## 9. Mainnet prohibition

No mainnet deployment, token mint, paid reward, or withdrawal is authorized until the reward vault is implemented and tested, all allocations and wallet addresses are approved, an independent smart-contract audit is complete, and the owner explicitly approves the final release. No signing transaction is performed by this repository workflow.
