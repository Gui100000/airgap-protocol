# 🔒 Security & Threat Model Policy

## Supported Versions
Only the latest release on the `main` branch is actively supported with security patches.

| Version | Supported          |
| ------- | ------------------ |
| 2.4.x   | :white_check_mark: |
| < 2.4   | :x:                |

## Zero-Network Security Guarantees
AirGap Protocol is architected around strict cryptographic and air-gap isolation invariants:
1. **Zero Cloud Connectivity**: Enforced at the browser sandbox level via Content Security Policy `connect-src 'none';`.
2. **Metadata Privacy**: Session timestamps are strictly relative (`T+00:00.0`) starting from entrance time, preventing timezone, system clock, or location fingerprinting.
3. **Deterministic Soliton Sampling**: Fountain code repair packets use an in-memory `SplitMix32` PRNG without telemetry leaks.

## Reporting Security Vulnerabilities
If you identify any security issue, cryptographic flaw in $\text{GF}(2)$ row reduction, or potential data leak:
- **Please DO NOT report security vulnerabilities through public GitHub issues.**
- Submit an issue tagged `[SECURITY REPORT]` or contact the maintainers via GitHub Security Advisories.
- We follow responsible disclosure practices and respond within 48 hours.
