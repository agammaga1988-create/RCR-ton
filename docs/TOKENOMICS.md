# RCR Tokenomics — Baseline

## Fixed supply

Total supply target: **1,000,000,000 RCR**.

Mining and user rewards allocation: **40% / 400,000,000 RCR**.

Approved token precision: **9 decimals**. The maximum lifetime issuance is 1,000,000,000 RCR (1,000,000,000,000,000,000 base units). Burns reduce circulating supply but **do not restore lifetime mint capacity**. Genesis supply is zero; no premint is authorized.

The minter enforces two distinct lifetime caps: up to **600,000,000 RCR** for the public issuer and up to **400,000,000 RCR** for the separate MiningIssuer. The combined lifetime issuance cannot exceed 1,000,000,000 RCR. MiningIssuer is deployed paused by default; the operator cannot register claims until the owner approves the reward formula and explicitly resumes the contract. Each claim is operator-authorized, uniquely identified, capped, and settled only after the Jetton master verifies the recipient wallet's transfer.

The remaining 60% is intentionally not assigned percentages in this baseline. The owner must approve a complete allocation table, vesting schedules, treasury controls, liquidity policy, and market-launch plan before token deployment. No percentages should be inferred or silently invented.

## Emission principles

- 24-hour earning sessions.
- Emission must be capped by the remaining rewards allocation.
- Reward formula and version must be visible and reproducible.
- No reward is payable merely because a client reports session completion.
- Contract-level claim validation and replay protection are required.
- Pauses and emergency controls must be documented and governed.

## Fees and treasury

Fee rates, fee recipients, marketing wallet, treasury wallet, and operational wallet addresses are **not configured**. They must be supplied and verified by the owner before any live transaction. Never embed private keys in this repository.

## Launch gates

1. Final allocation and vesting approved.
2. Token contract and distribution mechanics tested.
3. Independent contract/security review completed.
4. Treasury and marketing addresses verified by owner.
5. Testnet rehearsal and withdrawal accounting reconciled.
6. Explicit written approval for mainnet deployment.
