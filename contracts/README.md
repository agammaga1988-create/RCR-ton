# TON Contracts

Contract source implementation is the next engineering milestone. This directory is deliberately not deployable yet.

Read [the contract design and security gates](../docs/CONTRACT_DESIGN.md) before adding code.

## Required deliverables

- TEP-74 Jetton master and wallet, with TEP-64 metadata and standard getters.
- Fixed maximum supply of 1,000,000,000 RCR.
- Separate rewards vault capped at 400,000,000 RCR.
- Replay-protected, immutable claim IDs and amounts.
- Explicit role separation, pause controls, and safe mint-authority shutdown.
- Full Tact compiler build, TON Sandbox tests, property tests, and testnet rehearsal.

## Do not deploy

No Tact source, compiled artifacts, deployment config, token decimals, owner address, or reward formula has been approved yet. Do not turn an untested template into a production contract. The remaining 600,000,000 RCR allocation and all wallet destinations must be explicitly approved before token deployment.

**Never commit a seed phrase, private key, mnemonic, or wallet signing secret.** Public addresses can be supplied later for deployment configuration; they are not required for the current design phase.
