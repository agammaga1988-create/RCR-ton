# RCR TON Contract Design and Security Gates

Status: implemented testnet candidate; **not audited and not approved for mainnet**. The Tolk/Acton source builds in CI and the sandbox suite covers the Jetton, split issuance caps, claim replay protection, and settlement callbacks.

## 1. Standards and architecture

- TEP-74 Jetton master and per-owner Jetton wallets, with TEP-64 metadata.
- Current implementation: Tolk + Acton, based on the TON Jetton v2.1 reference.
- The earlier Tact port is legacy reference only and must not be deployed.
- Privileged code/data upgrade paths are absent.
- The minter tracks pending mint query IDs, recipient, issuer, amount and role. It verifies the derived Jetton wallet address before accepting settlement or bounce callbacks.

References:
- TEP-74: https://github.com/ton-blockchain/TEPs/blob/master/text/0074-jettons-standard.md
- TON Jetton architecture: https://docs.ton.org/standard/tokens/jettons/overview
- TON security/payment guidance: https://docs.ton.org/applications/payments/jettons

## 2. Approved supply invariants

- Maximum lifetime issuance: **1,000,000,000 RCR**.
- Fixed precision: **9 decimals** (1,000,000,000,000,000,000 base units).
- Public issuer lifetime cap: **600,000,000 RCR**.
- Separate MiningIssuer lifetime cap: **400,000,000 RCR**.
- Genesis supply: **zero**; no premint.
- Cumulative minted supply is separate from circulating supply. Burns do not restore issuance capacity; a failed/bounced mint restores the relevant counters.
- Public and mining issuer counters are independently bounded, and the combined minter cap is also enforced.
- The mining issuer role is configured once by the minter admin. It cannot be silently rotated.
- The Jetton master reports mintability from the remaining role allocations.

The split caps are not an instruction to mint. Every mint is an explicit signed transaction from the corresponding issuer. The MiningIssuer is deployed paused by default.

## 3. MiningIssuer and claim settlement

The separate MiningIssuer contract is implemented with:
- a hard 400,000,000 RCR reservation + paid cap;
- operator-only claim registration;
- unique uint64 claim IDs, mapped to a monotonic PostgreSQL BIGINT chain nonce;
- immutable recipient and amount per claim ID;
- duplicate-claim rejection;
- states for pending, paid and retryable;
- master-authenticated success/failure callbacks;
- retry only after an on-chain failure/bounce callback;
- admin pause/resume and operator rotation;
- no ability to redirect or seize holder balances.

The Jetton master authenticates the recipient's derived Jetton wallet before forwarding a success callback. On a bounced wallet transfer it restores lifetime issuance counters and sends a failure callback to the MiningIssuer. The issuer can then retry the same claim ID without creating a second payout.

**Important limitation:** the contract enforces authorization, replay protection, state transitions and the 400M cap; it does not calculate the reward formula. The reward amount is supplied by the authorized operator. The formula, eligibility policy, anti-abuse rules, and backend claim-calculation service have not been approved, so the MiningIssuer remains paused and the API does not expose a claim endpoint.

## 4. Administrative and treasury controls

- Jetton public issuer, MiningIssuer contract, MiningIssuer operator and treasury custody are separate roles.
- The deployment script sets the admin wallet as the initial public issuer, deploys the MiningIssuer paused, and configures the MiningIssuer address exactly once.
- Operator changes require the MiningIssuer admin.
- No private key, seed phrase, mnemonic, bot token or signing secret belongs in GitHub, frontend, CI, or the application database.
- Public wallet addresses may be used in deployment configuration; never provide secret signing material.
- A marketing wallet is only a destination for an approved allocation.
- No arbitrary user-balance seizure or hidden transfer tax is implemented.

## 5. Test matrix and current verification

CI runs the Tolk/Acton contract build and transaction-level sandbox tests covering:
- Jetton transfer, notification, excesses, burn, wallet derivation and getters;
- public 600M and mining 400M issuer caps;
- lifetime cap behavior across burns and bounce recovery;
- one-time mining issuer setup;
- unauthorized claim registration and duplicate claim IDs;
- successful payout settlement, failed mint retry and callback authorization;
- PostgreSQL migrations, idempotency and append-only audit controls;
- Telegram initData authentication and fail-closed production configuration.

Additional fuzz/property tests, gas-stress tests, a full testnet rehearsal, and an independent TON smart-contract audit remain required.

## 6. Decisions and addresses still required before release

Product decisions still open:
1. Reward formula, 24-hour session eligibility, per-session rate/limits, anti-abuse policy and backend calculation.
2. Suballocation/vesting of the 600M public issuance side, liquidity plan and marketing allocation.
3. Treasury and marketing public destination addresses.
4. Whether and when to irreversibly disable each issuer after its distribution phase; this must be explicitly designed and tested before mainnet.

Deployment needs public addresses only:
- deployer wallet;
- admin/public issuer wallet;
- MiningIssuer operator address (defaults to admin wallet if not supplied).

The deploy script can deploy both contracts on TON testnet and configures the MiningIssuer paused. Never send a seed phrase or private key. Do not deploy to mainnet, enable claims, or mint real-value tokens until the open product decisions are approved and an independent security review is complete.

## Release gate

Testnet deployment is permitted only as a controlled rehearsal with public testnet wallets and zero genesis supply. Mainnet, public trading, rewards, and withdrawals remain blocked pending the reward policy, allocation approvals, production hosting/Telegram configuration, testnet rehearsal, and independent security audit.
