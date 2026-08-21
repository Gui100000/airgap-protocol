# 🏛️ Architecture & System Design - AirGap Protocol

This document provides a deep architectural overview of **AirGap Protocol (`OPTX-v2`)**, detailing the data pipeline, state machines, worker concurrency model, and mathematical foundations.

---

## 1. High-Level Architectural Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TRANSMITTER (TX) PIPELINE                         │
└─────────────────────────────────────────────────────────────────────────────┘
  [ Ingest: Files / Text / Clipboard ]
                  │
                  ▼
  [ Compute SHA-256 Digest (Native or Pure JS) ]
                  │
                  ▼
  [ Optional: Deflate-Raw CompressionStream ]
                  │
                  ▼
  [ Sliced into K Blocks of Size L (e.g. 380 Bytes) ]
                  │
                  ▼
  [ Web Worker: worker-encoder.js ]
   ├── Phase 1 (Packets 0 .. K-1): Systematic Direct Droplets
   └── Phase 2 (Packets K .. ∞)  : Robust Soliton Linear Combinations (GF(2) XOR)
                  │
                  ▼
  [ OPTX-v2 20-Byte Wire Framing ]
                  │
                  ▼
  [ QR Engine: Pure JS Matrix Rasterization onto Canvas ]
                  │
                  ▼
  [ Optical Screen Display @ 15-30 FPS ]
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            RECEIVER (RX) PIPELINE                           │
└─────────────────────────────────────────────────────────────────────────────┘
  [ Optical Video Capture: Camera Stream ]
                  │
                  ▼
  [ Dual-Engine Scanner: BarcodeDetector API ──(Fallback)──► jsQR Engine ]
                  │
                  ▼
  [ OPTX-v2 Header Unpacking & Magic Validation ]
                  │
                  ▼
  [ Web Worker: worker-decoder.js ]
   ├── Peeling Decoder (Belief Propagation) on Degree-1 Droplets
   └── Incremental Gaussian Elimination on Upper-Triangular Matrix [G | Y]
                  │
                  ▼
  [ Complete Rank K Achieved ] ──► [ Reassemble Bitstream ]
                  │
                  ▼
  [ Optional: Decompress Deflate-Raw ]
                  │
                  ▼
  [ SHA-256 Integrity Verification: Bit-Exact Match ]
                  │
                  ▼
  [ Save File to Disk (Blob Download) ]
```

---

## 2. Concurrency & Web Worker Lifecycle

To prevent UI thread stutters and maintain 60 FPS rendering, all intensive matrix mathematics and linear equation solving are isolated in background Web Workers:

### `worker-encoder.js`
1. **Message `INIT`**: Receives raw file `ArrayBuffer`, chunk size $L$, and compression flag.
2. **Pre-computation**: Builds source blocks array and pre-calculates the Cumulative Distribution Function (CDF) for the Robust Soliton distribution.
3. **Message `GET_PACKET`**: Generates and transfers the requested frame index packet back to the main thread via zero-copy `ArrayBuffer` transfer.

### `worker-decoder.js`
1. **Message `INIT_SESSION`**: Initializes `GF2Solver` with total blocks $K$ and chunk size $L$.
2. **Message `PROCESS_PACKET`**: Ingests new optical payload, performs ripple peeling and incremental Gaussian elimination.
3. **Telemetry Posting**: Returns current rank, resolved block count, and bitmap constellation state to the UI thread every 50ms.
4. **Safety Timeout**: Limits maximum packet ingestion to $\max(500, 10K)$ packets to prevent memory exhaustion on corrupted channels.

---

## 3. Threat Model & Sandboxing

1. **Air-Gap Compliance**: Unidirectional optical link (photons only). Physical impossibility of reverse data exfiltration.
2. **CSP Enforcement**: `<meta http-equiv="Content-Security-Policy" content="... connect-src 'none';">`.
3. **Zero Telemetry**: All diagnostics remain inside the local browser memory and log buffer.
