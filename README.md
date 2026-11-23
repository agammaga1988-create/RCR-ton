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

Requirements: Node.js 22+, pnpm 9+, Docker (optional, for local PostgreSQL integration tests), and [Acton 1.2.1](https://ton-blockchain.github.io/acton/docs/installation) for Tolk contracts.

```bash
pnpm install
pnpm check
pnpm contracts:build
```

The primary Jetton implementation is Tolk/Acton Jetton v2.1 under `contracts/tolk`. with a 9-decimal lifetime issuance cap, burn-resistant mint accounting, and privileged code upgrades disabled. CI builds it and runs the upstream transaction-level Jetton suite plus RCR cap regression. The older Tact source under `contracts/src` is retained as a non-deployable migration reference. A capped MiningIssuer contract and its sandbox tests are implemented; it is deployed paused. The reward formula, eligibility/anti-abuse policy, backend claim registration, TON Connect UI, and actual testnet deployment still require completion and owner approval.

See [docs/ROADMAP.md](docs/ROADMAP.md) before implementing or enabling production functionality.
