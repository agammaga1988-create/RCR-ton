# RCR on TON

RCR is a Telegram-first, TON-native rewards and utility platform. This repository is the clean engineering foundation for the project.

## Initial product constraints

- Fixed token supply: 1,000,000,000 RCR.
- Mining/rewards allocation: 40% (400,000,000 RCR), subject to the published emission schedule and on-chain enforcement.
- Reward sessions: 24 hours.
- Hybrid model: off-chain session orchestration and eligibility checks; on-chain accounting, claims, and treasury controls.
- Staged launch: local development -> TON testnet -> independent security review -> explicitly approved mainnet release.
- Non-custodial user experience. Never request or store seed phrases or private keys.

## Repository layout

- `apps/miniapp` — Telegram Mini App frontend.
- `services/api` — API and session orchestration.
- `packages/shared` — shared schemas and domain types.
- `contracts` — TON contract sources and tests.
- `docs` — product, tokenomics, security, and operations specifications.

## Safety status

This is an engineering scaffold, not a deployed token or audited financial product. No mainnet deployment, live wallet connection, real token minting, or real withdrawals are enabled by this initial commit.

## Development

Requirements: Node.js 22+, pnpm 9+.

```bash
pnpm install
pnpm check
pnpm contracts:build
```

The TEP-74 Jetton master/wallet reference source is under `contracts/src`; the master adds an immutable maximum-supply guard. Its build is enforced in CI. The separate rewards vault, reward claims, wallet configuration, and testnet deployment are not complete yet.

See [docs/ROADMAP.md](docs/ROADMAP.md) before implementing or enabling production functionality.
