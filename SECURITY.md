# Security Policy

## Supported deployment state

RCR is currently pre-launch. The repository is not an audited token or production financial service. No mainnet deployment or real-value claim/withdrawal is authorized.

## Reporting a vulnerability

Do not publish exploit details, private keys, seed phrases, wallet recovery material, or sensitive user data in public issues.

Use GitHub's private vulnerability reporting feature for this repository when available. Include:
- affected commit and component;
- impact and realistic attack path;
- minimal reproduction or proof of concept;
- suggested mitigation, if known.

Do not test against mainnet users or third-party wallets. Use local tests or TON testnet only.

## Secret handling

Never send private keys, seed phrases, mnemonics, bot tokens, database passwords, or signing secrets in chat, GitHub issues, source files, or CI logs. Rotate any secret that may have been exposed.
