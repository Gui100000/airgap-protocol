# 🤝 Contributing to AirGap Protocol

Thank you for your interest in contributing to **AirGap Protocol**!

## Core Engineering Principles
1. **Zero External Runtime Dependencies**: All cryptographic hashing, fountain sampling, QR matrix rasterization, and image optimization MUST remain 100% self-contained in pure vanilla JavaScript/WebAssembly without third-party node_modules or CDN scripts.
2. **Zero Network Calls**: No feature may introduce `fetch()`, `XMLHttpRequest`, `WebSocket`, or cloud telemetry.
3. **Mathematical Rigor**: All modifications to the Soliton degree distribution or $\text{GF}(2)$ Gaussian solver must maintain 100% pass rate in `tests/test-fountain.js`.

## Development Workflow
```bash
# 1. Clone your fork
git clone https://github.com/<your-username>/airgap-protocol.git
cd airgap-protocol

# 2. Run verification test suite
node tests/test-fountain.js
node tests/test-qr.js

# 3. Test optical camera scanning locally
node server.js
```

## Pull Request Guidelines
- Follow existing modular architecture in `js/`.
- Ensure new features are accompanied by corresponding tests.
- Update `I18N_DICTIONARY` in `js/i18n.js` with both English and Italian translations.
