# Engineering Roadmap

## Phase 0 — Engineering foundation
- [x] Create repository and product/tokenomics specifications.
- [x] Establish pnpm workspace and GitHub Actions CI.
- [x] PostgreSQL schema, repeatable versioned migration runner, advisory locking.
- [x] Transactional session creation and active-session uniqueness.
- [x] Append-only audit events enforced by database triggers.
- [x] Telegram init-data HMAC verification and replay window.
- [x] API input limits, timeouts, rate limiting, and production fail-closed behavior.

## Phase 1 — Mini App and identity
- [x] Mobile-first Telegram Mini App interface.
- [x] Send raw Telegram initData to server for verification.
- [x] Session-start UI and server-authoritative countdown.
- [x] Static server security headers, Telegram frame policy, and same-origin API design.
- [x] API and Mini App regression tests in CI.
- [x] Persist and retrieve current session after app reload.
- [ ] Add TON Connect UI and verified testnet manifest.
- [ ] Distributed rate limiting for multi-instance production deployments.

## Phase 2 — Reward accounting and contracts
- [ ] Deterministic reward schedule with integer-only arithmetic and formula versioning.
- [ ] Atomic 400,000,000 RCR rewards allocation accounting.
- [x] TEP-74/TEP-89 Jetton v2.1 on Tolk/Acton with RCR max-supply enforcement and privileged code upgrades disabled.
- [ ] Separate 400,000,000 RCR reward vault with replay-safe claims and tested bounce/retry semantics.
- [x] Guarded Testnet deployment script: zero genesis supply, explicit decimals (0–18), integer-derived 1,000,000,000 RCR cap; CI checks the script.
- [x] Acton transaction-level Jetton suite (77 tests), RCR over-cap mint regression, and decimals/base-unit cap tests; [ ] additional property/fuzz tests for the reward vault.
- [ ] Testnet deployment, indexer reconciliation, and replay-protected claim flow.
- [ ] Treasury controls, multisig, pause roles, and event monitoring.

## Phase 3 — Launch readiness
- [ ] Independent smart-contract and application security review.
- [ ] Managed PostgreSQL backup/restore and disaster-recovery rehearsal.
- [ ] Production observability, alerting, WAF, and distributed abuse controls.
- [ ] Legal/compliance review for intended launch jurisdictions.
- [ ] Explicit owner approval before any mainnet release.

## Release policy

No mainnet endpoint, token mint, wallet custody, claims, or withdrawals are enabled. The Mini App can start a database-backed earning session only when deployed with Telegram authentication and PostgreSQL configured. A countdown is not a token balance or a promise of payment.
