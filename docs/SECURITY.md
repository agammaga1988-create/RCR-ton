# Security Boundaries and Threat Model

## Trust boundaries

- Telegram client: untrusted input.
- API: validates Telegram init data, session state, rate limits, and eligibility.
- Database: authoritative off-chain session/audit state; sensitive secrets excluded.
- TON contracts: authoritative on-chain token and claim enforcement.
- TON Connect: wallet interaction only; user signs transactions in their wallet.
- Operators: least-privilege access with auditable changes.

## Threats and controls

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

## Mandatory rules

- Never request, receive, log, or store seed phrases or private keys.
- Never put secrets in source control.
- Testnet only until explicit release approval.
- No autonomous transfer of user assets.
- Emergency pause must not permit arbitrary seizure of user funds.
- Security claims must not exceed completed evidence.
