# RCR TON Contract Design — Pre-Implementation Gate

Status: design specification only. This document is not deployable code and does not authorize a mainnet deployment.

## 1. Standards and architecture

RCR will be a TON Jetton using the TEP-74 master + per-owner Jetton-wallet architecture and TEP-64 metadata. The wallet implementation must be derived from a currently maintained Tact standard implementation and reviewed against the current TEPs. Do not copy a historical sample without checking compiler compatibility and all message handlers.

References:
- TEP-74: https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md
- TON Jetton architecture: https://docs.ton.org/standard/tokens/jettons/overview
- TON security/payment guidance: https://docs.ton.org/applications/payments/jettons

## 2. Supply invariants

- Maximum supply: 1,000,000,000 RCR.
- Maximum rewards allocation: 400,000,000 RCR.
- Rewards must never exceed the rewards allocation, even after burns, failed claims, retries, or administrative operations.
- Initial minting and any later minting must be bounded by a single immutable maximum-supply invariant.
- The mint authority must be permanently disabled after the approved initial mint/distribution process. There must be no hidden unlimited mint path.
- The contract must expose standard Jetton getters and return consistent total-supply data.

The token decimal count is intentionally unresolved. Do not convert whole-token caps into base units until the owner approves decimals. All on-chain arithmetic must use integer base units and checked bounds; no floating-point math.

## 3. Reward allocation and claims

A separate rewards vault/claim contract is preferred over embedding reward logic in the Jetton master.

Required properties:
- A fixed rewards cap of 400,000,000 RCR in base units, initialized once.
- Only an explicitly authorized backend signer/operator can register an eligible claim; the user never supplies a reward amount.
- Each claim has a unique session/claim identifier and a user destination address.
- A claim identifier can be consumed once only. Duplicate messages must not transfer twice.
- The vault's total reserved + paid rewards must not exceed the cap.
- Claim amount is immutable after registration.
- A failed outbound transfer must have a defined, tested recovery path that cannot double-pay.
- Pause controls can stop new claims; they cannot confiscate or redirect user balances.
- Operator rotation must be explicit and evented. High-risk operator changes should use multisig/timelock governance.

## 4. Administrative and treasury controls

- Separate Jetton mint authority, reward-operator authority, and treasury custody.
- No private key, seed phrase, mnemonic, or signing secret in GitHub, frontend, CI, or application database.
- Owner and treasury addresses must be verified from public wallet addresses and deployment state; never infer or invent them.
- A marketing wallet is a destination for approved allocations only, not a private-key value.
- Avoid arbitrary user-balance seizure, hidden transfer taxes, or mutable balances.
- All admin operations emit auditable on-chain events.

## 5. Required test matrix before testnet

- Jetton transfer, notification, excesses, burn, wallet derivation and getter compatibility.
- Unauthorized mint and unauthorized claim registration rejected.
- Mint over max supply rejected.
- Rewards reservation over 400,000,000 RCR rejected.
- Duplicate claim ID rejected with no second transfer.
- Invalid destination rejected.
- Pause blocks new claim registration and has no effect on existing holder balances.
- Operator rotation and renunciation edge cases.
- Bounce/failure recovery and gas starvation.
- Fuzz/property tests for integer bounds and conservation of balances.
- Sandbox tests for every message path and testnet rehearsal.

## 6. Inputs still required from project owner

These are product decisions, not values to guess:
1. Token decimals.
2. Complete allocation of the remaining 600,000,000 RCR, including vesting and liquidity.
3. Reward formula, eligibility policy, and per-session rate/limits.
4. Public owner/admin, rewards vault, treasury, and marketing wallet addresses.
5. Whether mint authority is renounced immediately after genesis mint or controlled by a multisig during a documented distribution window.

A public wallet address is not a secret. Never send a seed phrase or private key. Wallet addresses are only needed when creating deployment configuration and rehearsing testnet transactions; no wallet address is needed to continue local contract design and tests.

## Release gate

No contract deployment, minting, or mainnet transaction until source builds reproducibly, sandbox tests pass, testnet deployment is verified, and an independent TON smart-contract security review is complete.
