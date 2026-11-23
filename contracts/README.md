# RCR TON smart contracts

## Production-target toolchain: Tolk + Acton

The primary implementation is now under `tolk/`, based on the TON reference-grade Jetton v2.1 implementation in [ton-blockchain/acton-contracts](https://github.com/ton-blockchain/acton-contracts). It uses Tolk and the Acton toolchain, currently pinned to Acton 1.2.1.

The RCR changes:
- Add `maxSupply` and `totalMinted` to minter storage.
- Reject mint operations that would exceed the configured lifetime maximum; burns do not replenish mint capacity.
- Expose `get_max_supply()` and `get_cumulative_minted()`.
- Enforce separate 600,000,000 RCR public-issuer and 400,000,000 RCR mining-issuer lifetime caps.
- Keep the mining issuer unset at Jetton genesis, deploy a separate MiningIssuer, and allow the admin to configure it exactly once.
- MiningIssuer reserves and accounts for the 400,000,000 RCR mining cap, uses unique uint64 claim IDs, rejects duplicate claims, and pauses by default.
- Verify successful mint settlement from the Jetton master and recover failed/bounced claims to a retryable state without double-paying.
- Remove privileged code/data upgrade messages so the configured cap cannot be raised through an admin upgrade.
- Add a regression test proving an over-cap mint fails without changing supply or wallet balance.

Build and test from repository root:

```sh
pnpm contracts:build
pnpm contracts:test
```

The Acton tests are transaction-level tests, not static source scans. The CI runs 85 transaction-level tests across Jetton behavior, issuer caps, claim replay protection, settlement callbacks, and safe retries.

## Legacy Tact reference

`src/` contains an earlier Tact v1 Jetton reference port. The Tact compiler now emits a deprecation warning and TON recommends Tolk for new development. Do not deploy the legacy Tact version. The Tolk/Acton project is the production-target implementation.

## Release gates

The RCR Jetton source is not audited and is not approved for mainnet. The owner-approved token precision is 9 decimals; genesis supply remains zero. The following remain incomplete:
- Final token metadata and owner verification of the admin/public issuer and mining operator wallet addresses.
- Testnet deployment and end-to-end Telegram rehearsal; the deployment script now deploys both contracts and configures the one-time mining issuer role.
- Telegram TON Connect integration and verified testnet manifest.
- Owner-approved reward formula, eligibility/anti-abuse policy, and API claim calculation/registration; MiningIssuer remains paused until these are approved.
- Testnet deployment, end-to-end rehearsal, independent security review and explicit owner release approval.

Never commit seed phrases, private keys, mnemonics, or wallet signing secrets.
