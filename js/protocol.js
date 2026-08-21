/**
 * AirGap Protocol - OPTX-v2 Wire Protocol & Envelope Framing
 * 20-Byte Little-Endian Header + SHA-256 Envelope + Deflate Stream Helpers
 */

const OPTX_MAGIC = 0x5854504F; // "OPTX" in Little-Endian ('O'=0x4F, 'P'=0x50, 'T'=0x54, 'X'=0x58)
const HEADER_SIZE = 20;

const FLAGS = {
  SYSTEMATIC: 0x0001,
  FOUNTAIN:   0x0002,
  MANIFEST:   0x0004,
  COMPRESSED: 0x0008,
  FINAL_BLOCK:0x0010
};

class ProtocolEngine {
  /**
   * Generates a deterministic 32-bit File ID from file name, size and timestamp/hash.
   */
  static generateFileId(fileName, fileSize) {
    let hash = 0x811c9dc5; // FNV-1a offset basis
    const str = `${fileName}:${fileSize}:${Date.now()}`;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193); // FNV prime
    }
    return (hash >>> 0); // Convert to unsigned 32-bit uint
  }

  /**
   * Serializes a packet frame with 20-byte OPTX header.
   */
  static serializePacket({ fileId, packetIndex, totalBlocksK, flags = 0, payload = new Uint8Array(0) }) {
    const payloadLen = payload.byteLength;
    const packet = new Uint8Array(HEADER_SIZE + payloadLen);
    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);

    // 0..3: Magic "OPTX"
    view.setUint32(0, OPTX_MAGIC, true);
    // 4..7: File ID (Uint32)
    view.setUint32(4, fileId >>> 0, true);
    // 8..11: Packet Index / PRNG Seed (Uint32)
    view.setUint32(8, packetIndex >>> 0, true);
    // 12..15: Total Source Blocks K (Uint32)
    view.setUint32(12, totalBlocksK >>> 0, true);
    // 16..17: Payload Length (Uint16)
    view.setUint16(16, payloadLen, true);
    // 18..19: Flags (Uint16)
    view.setUint16(18, flags, true);

    // 20..N: Data payload
    if (payloadLen > 0) {
      packet.set(payload, HEADER_SIZE);
    }

    return packet;
  }

  /**
   * Deserializes a raw buffer into an OPTX packet object.
   */
  static deserializePacket(rawBuffer) {
    if (!rawBuffer || rawBuffer.byteLength < HEADER_SIZE) {
      return null;
    }

    const uint8 = rawBuffer instanceof Uint8Array ? rawBuffer : new Uint8Array(rawBuffer);
    const view = new DataView(uint8.buffer, uint8.byteOffset, uint8.byteLength);

    const magic = view.getUint32(0, true);
    if (magic !== OPTX_MAGIC) {
      return null; // Invalid magic header
    }

    const fileId = view.getUint32(4, true);
    const packetIndex = view.getUint32(8, true);
    const totalBlocksK = view.getUint32(12, true);
    const payloadLen = view.getUint16(16, true);
    const flags = view.getUint16(18, true);

    if (uint8.byteLength < HEADER_SIZE + payloadLen) {
      return null; // Incomplete packet frame
    }

    const payload = uint8.subarray(HEADER_SIZE, HEADER_SIZE + payloadLen);

    return {
      magicValid: true,
      fileId,
      packetIndex,
      totalBlocksK,
      payloadLen,
      flags,
      payload: new Uint8Array(payload) // Safe copy
    };
  }

  /**
   * Serializes File Manifest into a JSON binary payload.
   */
  static serializeManifest({ fileName, fileSize, mimeType, sha256, chunkSize, totalBlocksK, isCompressed = false, origSize = fileSize }) {
    const manifestObj = {
      n: fileName,
      s: fileSize,
      m: mimeType || 'application/octet-stream',
      h: sha256,
      c: chunkSize,
      k: totalBlocksK,
      z: isCompressed ? 1 : 0,
      o: origSize
    };
    const jsonStr = JSON.stringify(manifestObj);
    const encoder = new TextEncoder();
    return encoder.encode(jsonStr);
  }

  /**
   * Deserializes a JSON binary payload into File Manifest object.
   */
  static deserializeManifest(payloadUint8) {
    try {
      const decoder = new TextDecoder();
      const jsonStr = decoder.decode(payloadUint8);
      const m = JSON.parse(jsonStr);
      return {
        fileName: m.n,
        fileSize: m.s,
        mimeType: m.m,
        sha256: m.h,
        chunkSize: m.c,
        totalBlocksK: m.k,
        isCompressed: m.z === 1,
        origSize: m.o
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Pure JS SHA-256 fallback (works in Node.js, Web Workers, non-secure contexts).
   */
  static async computeSHA256(arrayBuffer) {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      try {
        const hashBuf = await crypto.subtle.digest('SHA-256', arrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuf));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        // Fall back to software implementation
      }
    }

    if (typeof require !== 'undefined') {
      try {
        const nodeCrypto = require('crypto');
        const hash = nodeCrypto.createHash('sha256');
        hash.update(Buffer.from(arrayBuffer));
        return hash.digest('hex');
      } catch (e) {}
    }

    // Pure JS SHA-256 fallback
    return ProtocolEngine._jsSHA256(new Uint8Array(arrayBuffer));
  }

  static _jsSHA256(bytes) {
    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const len = bytes.length;
    const bitLen = len * 8;

    // Standard SHA-256 padding: 0x80, zeros, 64-bit length (big-endian)
    const totalLen = Math.ceil((len + 1 + 8) / 64) * 64;
    const padded = new Uint8Array(totalLen);
    padded.set(bytes);
    padded[len] = 0x80;

    const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
    view.setUint32(totalLen - 4, bitLen >>> 0, false);
    view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);

    const W = new Uint32Array(64);
    for (let i = 0; i < padded.length; i += 64) {
      for (let t = 0; t < 16; t++) {
        W[t] = view.getUint32(i + t * 4, false);
      }
      for (let t = 16; t < 64; t++) {
        const s0 = ((W[t - 15] >>> 7) | (W[t - 15] << 25)) ^ ((W[t - 15] >>> 18) | (W[t - 15] << 14)) ^ (W[t - 15] >>> 3);
        const s1 = ((W[t - 2] >>> 17) | (W[t - 2] << 15)) ^ ((W[t - 2] >>> 19) | (W[t - 2] << 13)) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }

      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ ((~e) & g);
        const temp1 = (h + S1 + ch + K[t] + W[t]) | 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) | 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) | 0;
      }

      H[0] = (H[0] + a) | 0;
      H[1] = (H[1] + b) | 0;
      H[2] = (H[2] + c) | 0;
      H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0;
      H[5] = (H[5] + f) | 0;
      H[6] = (H[6] + g) | 0;
      H[7] = (H[7] + h) | 0;
    }

    return H.map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
  }

  /**
   * Compresses an ArrayBuffer using native CompressionStream ('deflate-raw').
   */
  static async compress(dataBuffer) {
    const uint8 = dataBuffer instanceof Uint8Array ? dataBuffer : new Uint8Array(dataBuffer);
    if (typeof CompressionStream !== 'undefined') {
      try {
        const cs = new CompressionStream('deflate-raw');
        const writer = cs.writable.getWriter();
        writer.write(uint8);
        writer.close();
        const reader = cs.readable.getReader();
        const chunks = [];
        let totalLen = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLen += value.byteLength;
        }
        const result = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return result;
      } catch (e) {
        console.warn('CompressionStream failed, returning uncompressed:', e);
      }
    }
    return uint8;
  }

  /**
   * Decompresses an ArrayBuffer using native DecompressionStream ('deflate-raw').
   */
  static async decompress(compressedBuffer) {
    const uint8 = compressedBuffer instanceof Uint8Array ? compressedBuffer : new Uint8Array(compressedBuffer);
    if (typeof DecompressionStream !== 'undefined') {
      try {
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        writer.write(uint8);
        writer.close();
        const reader = ds.readable.getReader();
        const chunks = [];
        let totalLen = 0;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          chunks.push(value);
          totalLen += value.byteLength;
        }
        const result = new Uint8Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
          result.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return result;
      } catch (e) {
        console.error('DecompressionStream failed:', e);
        throw e;
      }
    }
    return new Uint8Array(compressedBuffer);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OPTX_MAGIC, HEADER_SIZE, FLAGS, ProtocolEngine };
} else if (typeof window !== 'undefined') {
  window.OPTX_MAGIC = OPTX_MAGIC;
  window.HEADER_SIZE = HEADER_SIZE;
  window.FLAGS = FLAGS;
  window.ProtocolEngine = ProtocolEngine;
}
