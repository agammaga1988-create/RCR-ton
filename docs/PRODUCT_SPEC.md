# RCR Product Specification

## Product

RCR is a Telegram Mini App with a TON-native token/rewards layer. The user journey is designed around a 24-hour earning session, transparent reward accounting, and controlled claims.

## Core requirements

1. Telegram WebApp identity is verified server-side using Telegram's official init-data validation procedure. Client-provided user IDs are never trusted.
2. Wallet connection uses TON Connect. The app never handles seed phrases or private keys.
3. One active earning session per eligible account unless a future, reviewed rule explicitly changes this.
4. Session duration is 24 hours. Server time is authoritative; clients cannot accelerate or replay sessions.
5. Reward calculation is deterministic, versioned, auditable, and bounded by the 400,000,000 RCR rewards allocation.
6. Withdrawals are claim-based and subject to contract limits, eligibility, anti-abuse controls, and disclosed fees.
7. All treasury and fee movements are recorded in an append-only audit trail.
8. Mainnet features remain disabled until tests, security review, legal review, and explicit owner approval are complete.

## User-facing states

- Not connected
- Wallet connected
- Session ready
- Session active
- Session completed
- Claim available
- Claim pending
- Claim confirmed
- Restricted / review required

## Non-goals for MVP

- Custodial wallets
- Private-key collection
- Guaranteed yield or investment-return claims
- Unbounded token emissions
- Automatic mainnet deployment
