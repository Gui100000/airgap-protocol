/**
 * AirGap Protocol - Systematic Fountain Codes & GF(2) Solver Engine
 * Implements Robust Soliton Distribution, Deterministic SplitMix32 PRNG,
 * Vectorized GF(2) XOR, Ripple Peeling Decoder & Incremental Gaussian Elimination.
 */

class SplitMix32 {
  constructor(seed) {
    this.state = (seed >>> 0) || 1;
  }

  next() {
    let z = (this.state = (this.state + 0x9e3779b9) | 0);
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    return ((z ^ (z >>> 15)) >>> 0) / 4294967296;
  }

  nextInt(max) {
    return Math.floor(this.next() * max);
  }
}

class RobustSolitonDistribution {
  constructor(K, c = 0.1, delta = 0.5) {
    this.K = Math.max(1, K);
    this.c = c;
    this.delta = delta;
    this.cdf = new Float64Array(this.K + 1);
    this._buildDistribution();
  }

  _buildDistribution() {
    const K = this.K;
    if (K === 1) {
      this.cdf[1] = 1.0;
      return;
    }

    const S = this.c * Math.log(K / this.delta) * Math.sqrt(K);
    const pivot = Math.min(K, Math.max(1, Math.floor(K / S)));

    const rho = new Float64Array(K + 1);
    rho[1] = 1.0 / K;
    for (let i = 2; i <= K; i++) {
      rho[i] = 1.0 / (i * (i - 1));
    }

    const tau = new Float64Array(K + 1);
    for (let i = 1; i < pivot; i++) {
      tau[i] = S / (K * i);
    }
    if (pivot <= K) {
      tau[pivot] = (S * Math.log(S / this.delta)) / K;
    }

    let beta = 0;
    for (let i = 1; i <= K; i++) {
      beta += rho[i] + tau[i];
    }

    let cum = 0;
    for (let i = 1; i <= K; i++) {
      const prob = (rho[i] + tau[i]) / beta;
      cum += prob;
      this.cdf[i] = Math.min(1.0, cum);
    }
    this.cdf[K] = 1.0; // Ensure ceiling
  }

  sampleDegree(prng) {
    if (this.K === 1) return 1;
    const r = prng.next();
    // Binary search in CDF
    let low = 1, high = this.K;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.cdf[mid] >= r) {
        high = mid;
      } else {
        low = mid + 1;
      }
    }
    return low;
  }
}

class FountainCodec {
  /**
   * Samples deterministic neighbors for a given packet index and fileId.
   */
  static getPacketNeighbors(fileId, packetIndex, totalBlocksK, soliton) {
    if (totalBlocksK <= 1) {
      return [0];
    }

    // Systematic Phase (0 <= packetIndex < K) -> Exact Degree 1
    if (packetIndex < totalBlocksK) {
      return [packetIndex];
    }

    // Fountain Phase (packetIndex >= K) -> Sample from Soliton Distribution
    const seed = (fileId ^ Math.imul(packetIndex >>> 0, 0x9e3779b9)) >>> 0;
    const prng = new SplitMix32(seed);
    const degree = soliton ? soliton.sampleDegree(prng) : 2;

    const neighbors = [];
    // Reservoir sampling / Knuth shuffle for degree distinct indices
    const available = new Uint32Array(totalBlocksK);
    for (let i = 0; i < totalBlocksK; i++) available[i] = i;

    let remaining = totalBlocksK;
    for (let i = 0; i < degree; i++) {
      const idx = prng.nextInt(remaining);
      neighbors.push(available[idx]);
      available[idx] = available[remaining - 1];
      remaining--;
    }

    return neighbors;
  }

  /**
   * High performance in-place XOR for typed byte arrays.
   */
  static xorBuffers(target, source) {
    const len = Math.min(target.length, source.length);
    const words32 = len >>> 2;
    const target32 = new Uint32Array(target.buffer, target.byteOffset, words32);
    const source32 = new Uint32Array(source.buffer, source.byteOffset, words32);

    for (let i = 0; i < words32; i++) {
      target32[i] ^= source32[i];
    }

    // Handle tail bytes
    const tailOffset = words32 << 2;
    for (let i = tailOffset; i < len; i++) {
      target[i] ^= source[i];
    }
  }

  /**
   * Chunks a binary buffer into K source blocks of fixed size L.
   */
  static chunkBuffer(buffer, chunkSize) {
    const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const totalBytes = uint8.byteLength;
    const K = Math.ceil(totalBytes / chunkSize);
    const blocks = new Array(K);

    for (let i = 0; i < K; i++) {
      const block = new Uint8Array(chunkSize);
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalBytes);
      block.set(uint8.subarray(start, end), 0);
      blocks[i] = block;
    }

    return { blocks, K, chunkSize, totalBytes };
  }
}

/**
 * High Performance GF(2) Equation Solver (Peeling + Incremental Gaussian Elimination)
 */
class GF2Solver {
  constructor(totalBlocksK, chunkSize) {
    this.K = totalBlocksK;
    this.chunkSize = chunkSize;
    this.soliton = new RobustSolitonDistribution(totalBlocksK);
    
    // Status tracking
    this.resolvedBlocks = new Array(this.K).fill(null);
    this.isResolved = new Uint8Array(this.K);
    this.resolvedCount = 0;

    // Bit-vector word sizing (32-bit words per equation)
    this.wordsPerEquation = Math.ceil(this.K / 32);
    
    // Gaussian elimination matrix state: pivotRow[pivotBit] = { mask: Uint32Array, payload: Uint8Array }
    this.pivotRows = new Array(this.K).fill(null);
    this.rank = 0;

    // Queue for cascading ripple peeling
    this.peelQueue = [];
    this.totalPacketsReceived = 0;
    this.droppedPackets = 0;
  }

  /**
   * Processes a received packet frame. Returns status object.
   */
  addPacket(packetIndex, payload, fileId) {
    this.totalPacketsReceived++;

    if (this.isComplete()) {
      return { isComplete: true, resolvedCount: this.resolvedCount, totalBlocksK: this.K, rank: this.rank };
    }

    // Determine neighbor indices
    const neighbors = FountainCodec.getPacketNeighbors(fileId, packetIndex, this.K, this.soliton);
    
    // Create equation mask
    const mask = new Uint32Array(this.wordsPerEquation);
    for (const n of neighbors) {
      mask[n >>> 5] |= (1 << (n & 31));
    }

    // Make copy of payload for row operations
    const eqPayload = new Uint8Array(this.chunkSize);
    eqPayload.set(payload.subarray(0, this.chunkSize));

    // Step 1: Reduce against all already-resolved blocks
    this._reduceAgainstResolved(mask, eqPayload);

    // Step 2: Check remaining degree
    const degree = this._getDegree(mask);
    if (degree === 0) {
      // Linearly dependent / redundant packet
      return { isComplete: this.isComplete(), resolvedCount: this.resolvedCount, totalBlocksK: this.K, rank: this.rank };
    }

    if (degree === 1) {
      // Immediate Peeling candidate!
      const blockIdx = this._getFirstNeighbor(mask);
      this._resolveBlock(blockIdx, eqPayload);
      this._cascadePeeling();
    } else {
      // Step 3: Incremental Gaussian Elimination
      this._insertGaussianRow(mask, eqPayload);
    }

    // Check if full rank achieved to solve remaining system
    if (!this.isComplete() && this.rank === this.K) {
      this._solveFullSystem();
    }

    return {
      isComplete: this.isComplete(),
      resolvedCount: this.resolvedCount,
      totalBlocksK: this.K,
      rank: this.rank,
      progressRatio: this.resolvedCount / this.K
    };
  }

  _getDegree(mask) {
    let count = 0;
    for (let w = 0; w < this.wordsPerEquation; w++) {
      let v = mask[w];
      if (v === 0) continue;
      // Bit count
      v = v - ((v >>> 1) & 0x55555555);
      v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
      count += (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
    }
    return count;
  }

  _getFirstNeighbor(mask) {
    for (let w = 0; w < this.wordsPerEquation; w++) {
      const v = mask[w];
      if (v !== 0) {
        const bit = 31 - Math.clz32(v & -v);
        return (w << 5) + bit;
      }
    }
    return -1;
  }

  _reduceAgainstResolved(mask, payload) {
    for (let w = 0; w < this.wordsPerEquation; w++) {
      let v = mask[w];
      if (v === 0) continue;
      for (let bit = 0; bit < 32; bit++) {
        if ((v & (1 << bit)) !== 0) {
          const blockIdx = (w << 5) + bit;
          if (blockIdx < this.K && this.isResolved[blockIdx]) {
            // Remove from mask and XOR resolved payload
            mask[w] ^= (1 << bit);
            FountainCodec.xorBuffers(payload, this.resolvedBlocks[blockIdx]);
          }
        }
      }
    }
  }

  _resolveBlock(blockIdx, payload) {
    if (this.isResolved[blockIdx]) return;

    const blockData = new Uint8Array(this.chunkSize);
    blockData.set(payload);
    this.resolvedBlocks[blockIdx] = blockData;
    this.isResolved[blockIdx] = 1;
    this.resolvedCount++;
    this.peelQueue.push(blockIdx);
  }

  _cascadePeeling() {
    while (this.peelQueue.length > 0) {
      const solvedIdx = this.peelQueue.shift();
      const wordIdx = solvedIdx >>> 5;
      const bitMask = 1 << (solvedIdx & 31);
      const solvedPayload = this.resolvedBlocks[solvedIdx];

      // Scan all stored pivot rows and reduce
      for (let p = 0; p < this.K; p++) {
        const row = this.pivotRows[p];
        if (row && (row.mask[wordIdx] & bitMask) !== 0) {
          row.mask[wordIdx] ^= bitMask;
          FountainCodec.xorBuffers(row.payload, solvedPayload);

          const deg = this._getDegree(row.mask);
          if (deg === 0) {
            this.pivotRows[p] = null;
            this.rank--;
          } else if (deg === 1) {
            const nextSolved = this._getFirstNeighbor(row.mask);
            const rowPayload = row.payload;
            this.pivotRows[p] = null;
            this.rank--;
            this._resolveBlock(nextSolved, rowPayload);
          }
        }
      }
    }
  }

  _insertGaussianRow(mask, payload) {
    let currentMask = new Uint32Array(mask);
    let currentPayload = new Uint8Array(payload);

    while (true) {
      const leadBit = this._getFirstNeighbor(currentMask);
      if (leadBit === -1) {
        // Redundant equation
        return;
      }

      if (!this.pivotRows[leadBit]) {
        // Found new pivot position!
        this.pivotRows[leadBit] = {
          mask: currentMask,
          payload: currentPayload
        };
        this.rank++;
        return;
      }

      // Eliminate with existing pivot
      const pivot = this.pivotRows[leadBit];
      for (let w = 0; w < this.wordsPerEquation; w++) {
        currentMask[w] ^= pivot.mask[w];
      }
      FountainCodec.xorBuffers(currentPayload, pivot.payload);

      const deg = this._getDegree(currentMask);
      if (deg === 0) return;
      if (deg === 1) {
        const solved = this._getFirstNeighbor(currentMask);
        this._resolveBlock(solved, currentPayload);
        this._cascadePeeling();
        return;
      }
    }
  }

  _solveFullSystem() {
    // Back-substitution from highest pivot down
    for (let i = this.K - 1; i >= 0; i--) {
      const row = this.pivotRows[i];
      if (!row) continue;
      this._reduceAgainstResolved(row.mask, row.payload);
      const deg = this._getDegree(row.mask);
      if (deg === 1) {
        const solved = this._getFirstNeighbor(row.mask);
        this._resolveBlock(solved, row.payload);
        this._cascadePeeling();
      }
    }
  }

  isComplete() {
    return this.resolvedCount >= this.K;
  }

  reconstructBuffer(originalFileSize) {
    if (!this.isComplete()) {
      throw new Error(`Cannot reconstruct buffer: only ${this.resolvedCount}/${this.K} blocks resolved.`);
    }

    const totalBytes = this.K * this.chunkSize;
    const output = new Uint8Array(totalBytes);
    for (let i = 0; i < this.K; i++) {
      output.set(this.resolvedBlocks[i], i * this.chunkSize);
    }

    if (originalFileSize && originalFileSize < totalBytes) {
      return output.subarray(0, originalFileSize);
    }
    return output;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    SplitMix32,
    RobustSolitonDistribution,
    FountainCodec,
    GF2Solver
  };
} else if (typeof window !== 'undefined') {
  window.SplitMix32 = SplitMix32;
  window.RobustSolitonDistribution = RobustSolitonDistribution;
  window.FountainCodec = FountainCodec;
  window.GF2Solver = GF2Solver;
}
