# RCR TON smart contracts

## Production-target toolchain: Tolk + Acton

The primary implementation is now under `tolk/`, based on the TON reference-grade Jetton v2.1 implementation in [ton-blockchain/acton-contracts](https://github.com/ton-blockchain/acton-contracts). It uses Tolk and the Acton toolchain, currently pinned to Acton 1.2.1.

The RCR changes:
- Add `maxSupply` to minter storage.
- Reject mint operations that would exceed the configured maximum.
- Expose `get_max_supply()`.
- Remove privileged code/data upgrade messages so the configured cap cannot be raised through an admin upgrade.
- Add a regression test proving an over-cap mint fails without changing supply or wallet balance.

Build and test from repository root:

```sh
pnpm contracts:build
pnpm contracts:test
```

The Acton tests are transaction-level tests, not static source scans. The CI runs the full upstream Jetton v2.1 test suite with the RCR cap regression.

## Legacy Tact reference

`src/` contains an earlier Tact v1 Jetton reference port. The Tact compiler now emits a deprecation warning and TON recommends Tolk for new development. Do not deploy the legacy Tact version. The Tolk/Acton project is the production-target implementation.

## Release gates

The RCR Jetton source is not audited and is not approved for mainnet. The following remain incomplete:
- A separate 400,000,000 RCR reward vault with signed, replay-safe claims and tested bounce/retry handling.
- Token decimals, exact base-unit cap, initial metadata and mint policy approval.
- Testnet deployment script is scaffolded; execution still requires owner/deployer wallet and explicit decimals.
- Telegram TON Connect integration and verified testnet manifest.
- Testnet deployment, end-to-end rehearsal, independent security review and explicit owner release approval.

Never commit seed phrases, private keys, mnemonics, or wallet signing secrets.
