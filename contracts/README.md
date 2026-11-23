# RCR TON smart contracts

The Jetton master and wallet in this directory are based on the MIT-licensed reference implementation maintained by TON Studio in [tact-lang/jetton](https://github.com/tact-lang/jetton). The upstream source copyright and SPDX headers are retained. Local changes add an immutable maximum-supply constructor parameter and enforce the cap before minting.

## Build

From repository root:

```sh
pnpm contracts:build
```

The build uses the pinned `@tact-lang/compiler@1.6.13` and Node.js 22. CI compiles the contracts on every push and pull request.

## RCR supply control

The master contract now requires a `maxSupply` constructor argument, rejects initial supply above it, and rejects mint operations that would exceed it. Deployment must set this value to the agreed base-unit representation of 1,000,000,000 RCR after token decimals are formally approved. Do not guess decimals or deploy with a guessed value.

## Scope and release status

This directory currently implements the TEP-74 Jetton master/wallet reference base with the RCR max-supply guard. It does **not** yet implement the separate 400,000,000 RCR reward vault, backend-signed claim registration, replay-safe claims, token metadata hosting, or deployment scripts. It is not audited and is not approved for mainnet.

Next required engineering steps are sandbox tests for the customized cap and all Jetton message paths, reward-vault design/implementation, wallet/deployment configuration, and an independent security review. Never add seed phrases or private keys to this repository.
