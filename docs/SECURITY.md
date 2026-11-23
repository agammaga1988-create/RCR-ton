# Security Boundaries and Threat Model

## Trust boundaries

- Telegram client: untrusted input.
- API: validates Telegram init data, session state, rate limits, and eligibility.
- Database: authoritative off-chain session/audit state; sensitive secrets excluded.
- TON contracts: authoritative on-chain token and claim enforcement.
- TON Connect: wallet interaction only; user signs transactions in their wallet.
- Operators: least-privilege access with auditable changes.

## Implemented baseline controls

- Telegram Mini App init data is HMAC-verified server-side; duplicate fields, invalid signatures, timestamps older than 15 minutes, future timestamps, and malformed user identities are rejected.
- Session requests have a 16 KiB body limit, JSON content-type validation, request/header timeouts, per-client in-process rate limiting, and generic 500 responses that do not expose database or stack details.
- Responses include no-store, nosniff, no-referrer, and restrictive content-security headers.
- Production session creation fails closed when Telegram authentication or PostgreSQL is not configured.
- PostgreSQL uses a transaction and a partial unique index to prevent overlapping active sessions.
- Audit rows reject UPDATE, DELETE, and TRUNCATE through database triggers; PUBLIC is also denied mutation privileges.
- Reward claims remain disabled. No wallet private keys or seed phrases are accepted or stored.

## Threats and required controls

| Threat | Required control |
|---|---|
| Forged Telegram identity | Verify init-data HMAC and auth_date server-side; reject stale data |
| Session replay | Unique session IDs, idempotency keys, server timestamps |
| Client reward manipulation | Recalculate on server; enforce allocation caps on-chain |
| Duplicate claims | Nonces / claim IDs and contract replay protection |
| Sybil abuse | Risk scoring, rate limits, review queue; avoid opaque confiscation |
| API compromise | Least privilege, secret rotation, network restrictions |
| Treasury key compromise | Multisig, hardware-backed custody, delayed high-risk operations |
| Malicious dependency | Lockfile, pinned versions, dependency scanning |
| Admin abuse | Append-only audit events and dual control for critical actions |

## Production limitations — not yet release-ready

- The API rate limiter is process-local. Production deployments with multiple instances or reverse proxies must add a trusted edge/WAF limit and a shared distributed limiter; do not trust arbitrary client-supplied forwarding headers.
- The migration runner uses a version ledger and PostgreSQL advisory lock; managed database role separation and restore rehearsal remain required. Use a dedicated migration role and a separate least-privilege runtime role.
- PostgreSQL integration tests run in CI against PostgreSQL 16. Production backup/restore rehearsal, monitoring, and independent security review are still required.
- Reward calculation, allocation accounting, claim authorization, treasury routing, and on-chain contracts are not yet enabled.
- Telegram Mini App is still a preview; TON Connect requires a deployed HTTPS manifest and testnet verification. The Mini App UI currently starts sessions but does not connect wallets.

## Mandatory rules

- Never request, receive, log, or store seed phrases or private keys.
- Never put secrets in source control.
- Testnet only until explicit release approval.
- No autonomous transfer of user assets.
- Emergency pause must not permit arbitrary seizure of user funds.
- Security claims must not exceed completed evidence.
