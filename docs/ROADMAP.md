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
- [x] Atomic 400,000,000 RCR mining allocation reservation/paid accounting in MiningIssuer.
- [x] TEP-74/TEP-89 Jetton v2.1 on Tolk/Acton with RCR lifetime max-supply enforcement, burns not restoring mint capacity, and privileged code upgrades disabled.
- [x] Enforce separate 600,000,000 public-issuer and 400,000,000 mining-issuer lifetime caps in the minter; mining issuer is configured once by admin.
- [x] Separate 400,000,000 RCR MiningIssuer with unique claim IDs, verified master callbacks, retryable bounce handling, and pause-by-default.
- [ ] Approve deterministic reward formula, eligibility/anti-abuse policy, and backend claim calculation; the on-chain issuer deliberately accepts only operator-authorized amounts.
- [x] Testnet deployment script deploys Jetton + MiningIssuer, zero genesis supply, proposed 9 decimals pending owner confirmation, split lifetime caps, and one-time mining issuer authorization.
- [x] Acton transaction-level suite (85 tests), RCR lifetime/public/mining cap regressions, replay protection, settlement callbacks, and safe claim retries.
- [ ] Additional property/fuzz tests and independent review of reward formula/backend eligibility.
- [ ] Testnet deployment, indexer reconciliation, and replay-protected claim flow.
- [x] Mining issuer pause/resume role and operator separation.
- [ ] Production treasury multisig, key rotation policy, and event monitoring.

## Phase 3 — Launch readiness
- [ ] Independent smart-contract and application security review.
- [ ] Managed PostgreSQL backup/restore and disaster-recovery rehearsal.
- [ ] Production observability, alerting, WAF, and distributed abuse controls.
- [ ] Legal/compliance review for intended launch jurisdictions.
- [ ] Explicit owner approval before any mainnet release.

## Release policy

No mainnet endpoint, token mint, wallet custody, claims, or withdrawals are enabled. The Mini App can start a database-backed earning session only when deployed with Telegram authentication and PostgreSQL configured. A countdown is not a token balance or a promise of payment.
