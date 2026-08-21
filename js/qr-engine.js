/**
 * AirGap Protocol - Zero-Dependency Standalone Fast QR Code Generator v2.3.0
 * Supports pure 8-bit binary mode (raw bytes 0x00..0xFF), QR Versions 1..40,
 * ECC Levels (L=1, M=0, Q=3, H=2), and ultra-crisp integer rasterization with ZERO gray artifacts.
 */

(function(global) {
  'use strict';

  const EXP_TABLE = new Uint8Array(512);
  const LOG_TABLE = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP_TABLE[i] = x;
      EXP_TABLE[i + 255] = x;
      LOG_TABLE[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
  })();

  function gfMul(x, y) {
    if (x === 0 || y === 0) return 0;
    return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
  }

  function rsGeneratorPoly(degree) {
    let poly = new Uint8Array([1]);
    for (let i = 0; i < degree; i++) {
      const next = new Uint8Array(poly.length + 1);
      const factor = EXP_TABLE[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= gfMul(poly[j], factor);
        next[j + 1] ^= poly[j];
      }
      poly = next;
    }
    return poly;
  }

  function rsComputeRemainder(data, polyDegree) {
    const genPoly = rsGeneratorPoly(polyDegree);
    const remainder = new Uint8Array(polyDegree);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ remainder[0];
      for (let j = 0; j < polyDegree - 1; j++) {
        remainder[j] = remainder[j + 1] ^ gfMul(genPoly[polyDegree - 1 - j], factor);
      }
      remainder[polyDegree - 1] = gfMul(genPoly[0], factor);
    }
    return remainder;
  }

  const ECC_LEVELS = {
    L: { id: 1, formatBits: 1 },
    M: { id: 0, formatBits: 0 },
    Q: { id: 3, formatBits: 3 },
    H: { id: 2, formatBits: 2 }
  };

  const QR_TABLE = [
    null,
    // 1..5
    { L:[19,7,1,19,0,0], M:[16,10,1,16,0,0], Q:[13,13,1,13,0,0], H:[9,17,1,9,0,0] },
    { L:[34,10,1,34,0,0], M:[28,16,1,28,0,0], Q:[22,22,1,22,0,0], H:[16,28,1,16,0,0] },
    { L:[55,15,1,55,0,0], M:[44,26,1,44,0,0], Q:[34,18,2,17,0,0], H:[26,22,2,13,0,0] },
    { L:[80,20,1,80,0,0], M:[64,18,2,32,0,0], Q:[48,26,2,24,0,0], H:[36,16,4,9,0,0] },
    { L:[108,26,1,108,0,0], M:[86,24,2,43,0,0], Q:[62,18,2,15,2,16], H:[46,22,2,11,2,12] },
    // 6..10
    { L:[136,18,2,68,0,0], M:[108,16,4,27,0,0], Q:[76,24,4,19,0,0], H:[60,28,4,15,0,0] },
    { L:[156,20,2,78,0,0], M:[124,18,4,31,0,0], Q:[88,18,2,14,4,15], H:[66,26,4,13,1,14] },
    { L:[194,24,2,97,0,0], M:[154,22,2,38,2,39], Q:[110,22,4,18,2,19], H:[86,26,4,14,2,15] },
    { L:[232,30,2,116,0,0], M:[182,22,3,36,2,37], Q:[132,20,4,16,4,17], H:[100,24,4,12,4,13] },
    { L:[274,18,2,68,2,69], M:[216,26,4,43,1,44], Q:[154,24,6,19,2,20], H:[122,28,6,15,2,16] },
    // 11..15
    { L:[324,20,4,81,0,0], M:[254,30,1,50,4,51], Q:[180,28,4,22,4,23], H:[140,24,3,12,8,13] },
    { L:[370,24,2,92,2,93], M:[290,22,6,36,2,37], Q:[206,26,4,20,6,21], H:[158,28,7,14,4,15] },
    { L:[428,26,4,107,0,0], M:[334,22,8,37,1,38], Q:[244,30,8,20,4,21], H:[180,22,12,11,4,12] },
    { L:[461,30,3,115,1,116], M:[365,24,4,40,5,41], Q:[261,22,11,16,5,17], H:[197,24,11,12,5,13] },
    { L:[523,22,5,87,1,88], M:[415,24,5,41,5,42], Q:[295,24,5,24,7,25], H:[223,24,11,12,7,13] },
    // 16..20
    { L:[589,24,5,98,1,99], M:[453,28,7,45,3,46], Q:[325,28,15,19,2,20], H:[253,30,3,15,13,16] },
    { L:[647,28,1,107,5,108], M:[507,28,10,46,1,47], Q:[367,28,1,22,15,23], H:[283,28,2,14,17,15] },
    { L:[721,30,5,120,1,121], M:[563,26,9,43,4,44], Q:[397,28,17,22,1,23], H:[313,28,2,14,19,15] },
    { L:[795,28,3,113,4,114], M:[627,26,3,44,11,45], Q:[445,26,17,21,4,22], H:[341,26,9,13,16,14] },
    { L:[861,28,3,107,5,108], M:[669,26,3,41,13,42], Q:[485,30,15,24,5,25], H:[385,28,15,15,10,16] },
    // 21..25
    { L:[932,28,4,116,4,117], M:[714,26,17,42,0,0], Q:[512,28,17,22,6,23], H:[406,30,19,16,6,17] },
    { L:[1006,28,2,111,7,112], M:[782,28,17,46,0,0], Q:[568,30,7,24,16,25], H:[442,24,34,13,0,0] },
    { L:[1094,30,4,121,5,122], M:[860,28,4,47,14,48], Q:[614,30,11,24,14,25], H:[464,30,16,15,14,16] },
    { L:[1174,30,6,117,4,118], M:[914,28,6,45,14,46], Q:[664,30,11,24,16,25], H:[514,30,30,16,2,17] },
    { L:[1276,26,8,106,4,107], M:[1000,28,8,47,13,48], Q:[718,30,7,24,22,25], H:[538,30,22,15,13,16] },
    // 26..30
    { L:[1370,28,10,114,2,115], M:[1062,28,19,46,4,47], Q:[754,30,28,22,6,23], H:[596,30,33,16,4,17] },
    { L:[1468,30,8,122,4,123], M:[1128,28,22,45,3,46], Q:[808,30,8,23,26,24], H:[628,30,12,15,28,16] },
    { L:[1531,30,3,117,10,118], M:[1193,28,3,45,23,46], Q:[871,30,4,24,31,25], H:[661,30,11,15,31,16] },
    { L:[1631,30,7,116,7,117], M:[1267,28,21,45,7,46], Q:[911,30,1,23,37,24], H:[701,30,19,15,26,16] },
    { L:[1735,30,5,115,10,116], M:[1373,28,19,47,10,48], Q:[985,30,15,24,25,25], H:[745,30,23,15,25,16] },
    // 31..35
    { L:[1843,30,13,115,3,116], M:[1455,28,2,46,29,47], Q:[1033,30,42,24,1,25], H:[793,30,23,15,28,16] },
    { L:[1955,30,17,115,0,0], M:[1541,28,10,46,23,47], Q:[1115,30,10,24,35,25], H:[845,30,19,15,35,16] },
    { L:[2071,30,17,115,1,116], M:[1631,28,14,46,21,47], Q:[1171,30,29,24,19,25], H:[901,30,11,15,46,16] },
    { L:[2191,30,13,115,6,116], M:[1725,28,14,46,23,47], Q:[1231,30,44,24,7,25], H:[961,30,59,16,1,17] },
    { L:[2306,30,12,121,7,122], M:[1812,28,12,47,26,48], Q:[1286,30,39,24,14,25], H:[986,30,22,15,41,16] },
    // 36..40
    { L:[2434,30,6,121,14,122], M:[1914,28,6,47,34,48], Q:[1354,30,46,24,10,25], H:[1054,30,2,15,64,16] },
    { L:[2566,30,17,122,4,123], M:[2022,28,29,46,14,47], Q:[1426,30,49,24,10,25], H:[1096,30,24,15,46,16] },
    { L:[2702,30,4,122,18,123], M:[2134,28,13,46,32,47], Q:[1502,30,48,24,14,25], H:[1142,30,42,15,32,16] },
    { L:[2812,30,20,117,4,118], M:[2213,28,40,47,7,48], Q:[1582,30,43,24,22,25], H:[1222,30,10,15,67,16] },
    { L:[2956,30,19,118,6,119], M:[2331,28,18,47,31,48], Q:[1666,30,34,24,34,25], H:[1276,30,20,15,61,16] }
  ];

  const ALIGNMENT_PATTERN_POS = [
    [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
    [6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70],
    [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86],
    [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98],
    [6, 30, 54, 78, 102], [6, 28, 54, 80, 106], [6, 32, 58, 84, 110],
    [6, 30, 58, 86, 114], [6, 34, 62, 90, 118], [6, 26, 50, 74, 98, 122],
    [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134],
    [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142], [6, 34, 62, 90, 118, 146],
    [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154],
    [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162],
    [6, 26, 54, 82, 110, 138, 166], [6, 30, 58, 86, 114, 142, 170]
  ];

  class BitBuffer {
    constructor() {
      this.buffer = [];
      this.length = 0;
    }
    put(num, length) {
      for (let i = 0; i < length; i++) {
        this.putBit(((num >>> (length - i - 1)) & 1) === 1);
      }
    }
    putBit(bit) {
      const bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) {
        this.buffer.push(0);
      }
      if (bit) {
        this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
      }
      this.length++;
    }
  }

  class QRCodeModel {
    constructor(typeNumber, errorCorrectLevel) {
      this.typeNumber = typeNumber;
      this.errorCorrectLevel = errorCorrectLevel;
      this.modules = null;
      this.moduleCount = 0;
      this.dataList = [];
    }

    addData(dataUint8) {
      this.dataList.push(dataUint8);
    }

    make() {
      if (this.typeNumber < 1) {
        this.typeNumber = this._getMinVersion();
      }
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (let row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount).fill(null);
      }

      this._setupPositionProbePattern(0, 0);
      this._setupPositionProbePattern(this.moduleCount - 7, 0);
      this._setupPositionProbePattern(0, this.moduleCount - 7);
      this._setupPositionAdjustPattern();
      this._setupTimingPattern();
      this._setupTypeInfo(true, 0);

      if (this.typeNumber >= 7) {
        this._setupTypeNumber(true);
      }

      const data = this._createData();
      this._mapData(data, 0);
    }

    _getMinVersion() {
      const bytesCount = this.dataList.reduce((acc, d) => acc + d.length, 0);
      for (let ver = 1; ver <= 40; ver++) {
        const spec = QR_TABLE[ver] && QR_TABLE[ver][this.errorCorrectLevel];
        if (spec) {
          const cap = spec[0] - (ver < 10 ? 2 : 3) - 1;
          if (bytesCount <= cap) return ver;
        }
      }
      return 40;
    }

    _setupPositionProbePattern(row, col) {
      for (let r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (let c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          if (
            (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
            (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4)
          ) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    }

    _setupTimingPattern() {
      for (let r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] === null) this.modules[r][6] = (r % 2 === 0);
      }
      for (let c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] === null) this.modules[6][c] = (c % 2 === 0);
      }
    }

    _setupPositionAdjustPattern() {
      const pos = ALIGNMENT_PATTERN_POS[this.typeNumber] || [];
      for (let i = 0; i < pos.length; i++) {
        for (let j = 0; j < pos.length; j++) {
          const row = pos[i];
          const col = pos[j];
          if (this.modules[row][col] !== null) continue;

          for (let r = -2; r <= 2; r++) {
            for (let c = -2; c <= 2; c++) {
              if (r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)) {
                this.modules[row + r][col + c] = true;
              } else {
                this.modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    }

    _setupTypeInfo(test, maskPattern) {
      const data = (ECC_LEVELS[this.errorCorrectLevel].formatBits << 3) | maskPattern;
      let bits = data << 10;
      let g = 0x537;
      for (let i = 4; i >= 0; i--) {
        if ((bits & (1 << (i + 10))) !== 0) {
          bits ^= (g << i);
        }
      }
      const format = ((data << 10) | bits) ^ 0x5412;

      for (let i = 0; i < 15; i++) {
        const mod = ((format >>> i) & 1) === 1;
        if (i < 6) this.modules[i][8] = mod;
        else if (i < 8) this.modules[i + 1][8] = mod;
        else this.modules[this.moduleCount - 15 + i][8] = mod;

        if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
        else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
        else this.modules[8][15 - i - 1] = mod;
      }
      this.modules[this.moduleCount - 8][8] = true;
    }

    _setupTypeNumber(test) {
      let bits = this.typeNumber << 12;
      let g = 0x1f25;
      for (let i = 5; i >= 0; i--) {
        if ((bits & (1 << (i + 12))) !== 0) bits ^= (g << i);
      }
      const num = (this.typeNumber << 12) | bits;
      for (let i = 0; i < 18; i++) {
        const mod = ((num >>> i) & 1) === 1;
        this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod;
        this.modules[(i % 3) + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    }

    _createData() {
      const buffer = new BitBuffer();
      buffer.put(0x04, 4);

      const totalLen = this.dataList.reduce((acc, d) => acc + d.length, 0);
      const countBits = this.typeNumber < 10 ? 8 : 16;
      buffer.put(totalLen, countBits);

      for (const d of this.dataList) {
        for (let i = 0; i < d.length; i++) {
          buffer.put(d[i], 8);
        }
      }

      const spec = QR_TABLE[this.typeNumber][this.errorCorrectLevel];
      const totalDataBytes = spec[0];

      if (buffer.length + 4 <= totalDataBytes * 8) {
        buffer.put(0, 4);
      }
      while (buffer.length % 8 !== 0) {
        buffer.putBit(false);
      }

      const padBytes = [0xEC, 0x11];
      let padIdx = 0;
      while (buffer.length < totalDataBytes * 8) {
        buffer.put(padBytes[padIdx % 2], 8);
        padIdx++;
      }

      const ecPerBlock = spec[1];
      const numBlocks1 = spec[2];
      const dataLen1 = spec[3];
      const numBlocks2 = spec[4];
      const dataLen2 = spec[5];

      const blocks = [];
      let offset = 0;

      for (let i = 0; i < numBlocks1; i++) {
        const data = new Uint8Array(dataLen1);
        for (let j = 0; j < dataLen1; j++) data[j] = buffer.buffer[offset++];
        const ec = rsComputeRemainder(data, ecPerBlock);
        blocks.push({ data, ec });
      }
      for (let i = 0; i < numBlocks2; i++) {
        const data = new Uint8Array(dataLen2);
        for (let j = 0; j < dataLen2; j++) data[j] = buffer.buffer[offset++];
        const ec = rsComputeRemainder(data, ecPerBlock);
        blocks.push({ data, ec });
      }

      const result = [];
      let maxDataLen = Math.max(dataLen1, dataLen2);
      for (let i = 0; i < maxDataLen; i++) {
        for (const b of blocks) {
          if (i < b.data.length) result.push(b.data[i]);
        }
      }
      for (let i = 0; i < ecPerBlock; i++) {
        for (const b of blocks) {
          result.push(b.ec[i]);
        }
      }

      return result;
    }

    _mapData(data, maskPattern) {
      let inc = -1;
      let row = this.moduleCount - 1;
      let bitIndex = 7;
      let byteIndex = 0;

      for (let col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col === 6) col--;

        while (true) {
          for (let c = 0; c < 2; c++) {
            if (this.modules[row][col - c] === null) {
              let dark = false;
              if (byteIndex < data.length) {
                dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
              }
              const mask = (row + (col - c)) % 2 === 0;
              this.modules[row][col - c] = dark ^ mask;

              bitIndex--;
              if (bitIndex === -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }

          row += inc;
          if (row < 0 || this.moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    }

    renderToCanvas(canvas, options = {}) {
      const moduleCount = this.moduleCount;
      const targetSize = options.size || 380;
      
      // Calculate integer cell size and margin to ensure 100% crisp pixels
      const minMargin = options.margin !== undefined ? options.margin : 3;
      const cellSize = Math.max(2, Math.floor(targetSize / (moduleCount + minMargin * 2)));
      const qrPixelSpan = moduleCount * cellSize;
      const actualSize = targetSize; // Maintain fixed constant canvas resolution!

      canvas.width = actualSize;
      canvas.height = actualSize;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = false;

      // 1. Fill entire canvas with pure crisp white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, actualSize, actualSize);

      // 2. Center QR matrix perfectly inside the canvas
      const startX = Math.floor((actualSize - qrPixelSpan) / 2);
      const startY = Math.floor((actualSize - qrPixelSpan) / 2);

      // 3. Render pure black modules with exact integer bounds
      ctx.fillStyle = '#000000';
      for (let r = 0; r < moduleCount; r++) {
        const y = startY + r * cellSize;
        for (let c = 0; c < moduleCount; c++) {
          if (this.modules[r][c]) {
            const x = startX + c * cellSize;
            ctx.fillRect(x, y, cellSize, cellSize);
          }
        }
      }
    }
  }

  const QREngine = {
    generate(binaryUint8, options = {}) {
      const ecc = options.ecc || 'M';
      const qr = new QRCodeModel(0, ecc);
      qr.addData(binaryUint8);
      qr.make();
      return qr;
    },

    render(binaryUint8, canvas, options = {}) {
      const qr = this.generate(binaryUint8, options);
      qr.renderToCanvas(canvas, options);
      return qr;
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { QREngine, QRCodeModel, ECC_LEVELS, QR_TABLE };
  }
  if (typeof window !== 'undefined') {
    window.QREngine = QREngine;
    window.QRCodeModel = QRCodeModel;
  } else if (typeof global !== 'undefined') {
    global.QREngine = QREngine;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
