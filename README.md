# 🌌 AirGap Protocol

> **100% Offline, Zero-Network PWA for High-Speed Binary File Transfers Across Air-Gapped Devices via Systematic Fountain Codes (LT / RaptorQ over GF(2)) and High-Density Visual QR Streams.**

![License](https://img.shields.io/badge/License-MIT-00f0ff.svg)
![Zero Network](https://img.shields.io/badge/Network-0%25%20(AirGapped)-39ff14.svg)
![PWA Offline](https://img.shields.io/badge/PWA-Cache--First-ff007f.svg)
![Specs](https://img.shields.io/badge/Wire%20Protocol-OPTX--v2-ffb703.svg)

---

## ⚡ Overview

**AirGap Protocol** enables unidirectional, high-throughput optical file transfers between physically isolated computers, smartphones, and tablets. It uses **Systematic Fountain Codes** over $\text{GF}(2)$ to deliver rateless optical data streams through animated QR codes (up to 60 FPS), with:

- 🛡️ **Zero Cloud Dependencies**: 100% Client-Side. No telemetry, no ads, no tracking, no cookies.
- 🔒 **Extreme CSP Isolation**: `connect-src 'none'` strictly prohibits any outbound network request.
- 📐 **Systematic Rateless Fountain Codes**:
  - Systematic stage: Instant $K$-frame direct decoding when visual reception is clean.
  - Fountain stage: Infinite pseudo-random XOR repair packets sampled from a Robust Soliton Distribution to seamlessly recover from dropped frames, camera blur, or visual occlusion.
- 🚀 **Hardware-Accelerated Dual Decoder**: Real-time Belief Propagation (Ripple Peeling) + 64-bit Bitset Gaussian Elimination over $\text{GF}(2)$ running inside dedicated background Web Workers.
- 🌐 **Bilingual (English / Italian)**: Dynamic, instant i18n translation toggle.
- 🛠️ **Utility Suite**: In-memory binary file splitting (`File.slice()`), multi-part merging, image payload optimization (WebP re-encoding), and hex dump inspection.

---

## 📡 Wire Protocol Specification (`OPTX-v2`)

Every visual frame contains a **20-byte Little-Endian fixed header** followed by the raw binary payload:

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                      Magic "OPTX" (0x5854504F)                |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                          File ID                              |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                 Packet Index / PRNG Seed                      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                    Total Source Blocks (K)                    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|         Payload Length        |             Flags             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
|                       Binary Data Payload                     |
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

### Flags Field (`Uint16`):
- `0x0001` - **`FLAG_SYSTEMATIC`**: Exact source block $B_i$ (degree 1).
- `0x0002` - **`FLAG_FOUNTAIN`**: Soliton XOR linear combination of source blocks.
- `0x0004` - **`FLAG_MANIFEST`**: File metadata envelope (File Name, Size, MIME, SHA-256).
- `0x0008` - **`FLAG_COMPRESSED`**: Deflate stream active on source payload.

---

## 🏗️ Project Architecture

```
airgap-protocol/
├── index.html              # Cyberpunk HUD UI with bilingual EN/IT translation dictionary
├── manifest.json           # Offline PWA manifest (standalone display mode)
├── sw.js                   # Cache-First Service Worker (Zero external network calls)
├── server.js               # Zero-dependency local testing HTTP server
├── css/
│   └── style.css           # Dark cyberpunk design system (Mobile, Tablet, Desktop, TV 4K)
├── js/
│   ├── app.js              # State machine and UI bindings
│   ├── protocol.js         # OPTX-v2 wire framing, SHA-256 integrity & Deflate stream
│   ├── fountain.js         # Robust Soliton distribution, SplitMix32 PRNG & GF(2) Solver
│   ├── qr-engine.js        # Zero-dependency pure binary QR matrix generator & canvas renderer
│   ├── qr-scanner.js       # Dual-engine scanner: BarcodeDetector API + jsQR fallback
│   ├── jsqr.js             # Embedded fallback QR recognizer
│   ├── worker-encoder.js   # Background Web Worker for chunking & Soliton sampling
│   ├── worker-decoder.js   # Background Web Worker for Belief Propagation & GF(2) solver
│   ├── utilities.js        # In-memory file splitter, merger & image optimizer
│   └── logger.js           # Structured in-memory log manager with zero storage leak
└── tests/
    └── test-fountain.js    # Mathematical verification test suite (100% pass)
```

---

## 🧪 Mathematical Verification Suite

To run the automated mathematical test suite:

```bash
node tests/test-fountain.js
```

### Test Coverage:
1. `OPTX-v2` 20-byte wire header serialization and bit-exact parsing.
2. Cryptographic SHA-256 integrity check.
3. Systematic Fountain Mode (0% loss, immediate $K$-frame recovery).
4. Optical Channel Simulation (30% random packet loss + Soliton fountain recovery).
5. Extreme Burst Loss (70% early occlusion + pure fountain repair).
6. Multi-megabyte file chunking and reconstruction with bit-for-bit SHA-256 match.

---

## 🚀 Getting Started (Zero Installation)

1. Clone or download this repository.
2. Serve the directory with any local static HTTP server (e.g. `node server.js` or `python -m http.server 8080`).
3. Open `http://127.0.0.1:8080/` in your browser.
4. Once loaded, you can disconnect all network adapters (Wi-Fi, Ethernet, Bluetooth) — the Service Worker keeps the application 100% operational offline.

---

## 📜 License

MIT License. Free and open source for everyone.
