# RCR Fees, Treasury, and Marketing Wallet Boundaries

## Current implementation status

RCR does **not** currently charge a protocol fee or a Jetton transfer tax. The Tolk `fees-management.tolk` module calculates TON gas/storage requirements only; it is not a revenue-collection mechanism. The current Mini App does not accept deposits, withdrawals, swaps, or paid claims. Therefore no fee revenue is currently generated and no fee wallet can be truthfully described as earning revenue.

## Required wallet separation

Keep these roles separate unless the owner explicitly approves a documented multisig policy:

| Role | Purpose | Current status |
|---|---|---|
| Deployment wallet | Pays deployment gas and deploys contracts | Owner-provided public address recorded |
| Admin wallet | Controls Jetton administration and issuer authorization | Owner-provided public address recorded |
| Protocol treasury | Receives any future, explicitly disclosed protocol fees | Not supplied |
| Marketing wallet | Receives the approved marketing budget from treasury | Not supplied |
| Rewards vault / issuer | Holds or authorizes the capped 400M RCR mining allocation | MiningIssuer contract; paused by default |

Do not silently reuse the deployment or admin wallet as the treasury or marketing wallet. Do not embed private keys in the repository.

## Fee design gate

Before implementing any fee mechanism, approve:
1. The exact user action that incurs a fee and the fee denomination (TON or RCR).
2. The rate or fixed amount, minimum/maximum, and who pays it.
3. A transparent split between treasury, marketing, operations, and any other recipient.
4. Public addresses for treasury and marketing, independently verified by the owner.
5. A withdrawal, accounting, and emergency-pause policy.
6. Tests proving no unintended fee can be charged on ordinary Jetton transfers.

Prefer an explicit application-level fee for a real service over a hidden transfer tax. Any fee must be disclosed in the Mini App before the user signs a transaction. Never introduce an undisclosed transfer tax or take fees from user assets without explicit approval.

## Release gate

No fee collection is enabled in the current release. A marketing wallet should only be funded from a clearly defined and auditable revenue source after the fee design and recipient addresses are approved.
