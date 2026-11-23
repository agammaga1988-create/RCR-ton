# Data Model

- `app_users`: internal user record and verified Telegram numeric ID. Wallet addresses are public identifiers, not authentication credentials.
- `earning_sessions`: server-authoritative 24-hour earning sessions. A partial unique index prevents concurrent active sessions per user.
- `reward_claims`: one claim record per session; transaction hash uniqueness prevents duplicate chain settlement.
- `reward_program_config`: one owner-approved policy record. It is seeded disabled with formula, precision, rate, cap, and approval fields unset.
- `reward_ledger`: one immutable accounting fact per earning session, with constrained state transitions and a unique optional claim link. It is a schema foundation; no reward accrual or payout API currently writes to it.
- `audit_events`: append-only operational evidence. Application runtime must not receive update/delete/truncate privileges.

All token amounts use integer base units represented as PostgreSQL NUMERIC(78,0). Never use floating-point arithmetic for token accounting.
