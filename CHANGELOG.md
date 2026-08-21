# 📜 Changelog - AirGap Protocol

All notable changes to **AirGap Protocol** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.4.0] - 2026-08-21

### 🚀 Added
- **Smart File Splitter**: Added dual-mode splitting (by fixed byte size or into exactly $N$ equal parts $1 \dots 100$).
- **1-Click ZIP Packaging**: Zero-dependency pure-JS in-memory ZIP builder (`AirgapUtilities.createZipBundle`) to download all slice parts in a single file without browser multi-download permission blocks.
- **Interactive QR Test Pattern**: Real-time test pattern preview reacting live to Chunk Density and ECC level changes when idle.
- **Direct Clipboard Paste (Ctrl+V / Cmd+V)**: Ingest payloads directly from clipboard without opening the file dialog.
- **Screen Wake Lock API**: Automatically prevents mobile devices from sleeping during active transmission and camera scanning.
- **NIST Known Answer Tests (KAT)**: Added SHA-256 verification suite in `tests/test-fountain.js` verifying bit-exact hashes between Native `crypto.subtle` and Pure JS `_jsSHA256`.
- **GF(2) Solver Rate Limiting**: Added timeout check (`maxPacketsLimit = Math.max(500, K * 10)`) preventing memory exhaustion on corrupted channels.
- **Official Cyberpunk Visual Identity**: High-definition laser shield logo integrated across favicon, app header, and documentation.
- **Automated CI/CD**: Added GitHub Actions workflow running test matrices across Node.js 18, 20, and 22.

### 🛡️ Security & Privacy
- **Session-Relative Privacy Timestamps**: Eliminated system clock/timezone leakage by anchoring logs to session second zero (`T+00:00.0`).
- **Enforced Strict CSP**: Zero network egress (`connect-src 'none'`).
- **NIST Vector Validation**: Zero discrepancies in cryptographic integrity checksums.

### 🐛 Fixed
- Resolved file dialog re-triggering when clicking delete (`✖`) in the Utility Suite.
- Resolved DataView `byteOffset` boundary handling in pure JS fallback SHA-256 algorithm.
- Resolved browser PWA cache persistence with Network-First auto-update activation.

---

## [2.3.0] - 2026-08-20

### 🚀 Added
- **Multi-File Transfer Bundle**: Ingestion of multiple files into a unified SHA-256 verified transmission stream.
- **Cyberpunk HUD Theme Switcher**: 4 distinct color schemes (Cyber Cyan, Matrix Emerald, Amber Terminal, Crimson Protocol).
- **Web Audio Beep Synthesizer**: Pure Web Audio oscillator feedback with customizable volume control.
- **Utility Suite**: Standalone offline file splitter, merger, and local WebP/JPEG image optimizer.

---

## [2.0.0] - 2026-08-20

### 🚀 Initial Major Release (`OPTX-v2`)
- 20-Byte Little-Endian binary wire framing protocol.
- Systematic Luby Transform with Robust Soliton degree distribution over $\text{GF}(2)$.
- Dual-engine camera scanner with native `BarcodeDetector` and pure JS fallback.
- Multi-threaded Web Workers for background encoding and Gaussian elimination decoding.
