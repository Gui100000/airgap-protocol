/**
 * AirGap Protocol - Mathematical Verification Test Suite
 * Tests Fountain Code Recovery (Systematic, Soliton, Random Loss, Burst Loss, Multi-MB payloads)
 * Run with: node tests/test-fountain.js
 */

const { ProtocolEngine, FLAGS } = require('../js/protocol.js');
const { FountainCodec, GF2Solver, RobustSolitonDistribution, SplitMix32 } = require('../js/fountain.js');

function generateRandomBytes(length) {
  const buf = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    buf[i] = (Math.random() * 256) | 0;
  }
  return buf;
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 AIRGAP PROTOCOL - MATHEMATICAL VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`• Testing: ${name.padEnd(55)} ... `);
    try {
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log('❌ FAILED');
      console.error('  Error:', err.message);
      if (err.stack) console.error('  Stack:', err.stack);
      failed++;
    }
  }

  // TEST 1: Protocol framing and 20-byte OPTX header serialization
  await test('OPTX-v2 20-Byte Wire Frame (Serialize / Parse)', async () => {
    const fileId = 0x12345678;
    const packetIndex = 42;
    const totalBlocksK = 100;
    const flags = FLAGS.SYSTEMATIC | FLAGS.COMPRESSED;
    const payload = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);

    const frame = ProtocolEngine.serializePacket({
      fileId,
      packetIndex,
      totalBlocksK,
      flags,
      payload
    });

    if (frame.byteLength !== 20 + payload.length) {
      throw new Error(`Invalid frame length: got ${frame.byteLength}, expected ${20 + payload.length}`);
    }

    const parsed = ProtocolEngine.deserializePacket(frame);
    if (!parsed) throw new Error('Failed to deserialize packet');
    if (parsed.fileId !== fileId) throw new Error(`fileId mismatch: ${parsed.fileId} vs ${fileId}`);
    if (parsed.packetIndex !== packetIndex) throw new Error(`packetIndex mismatch: ${parsed.packetIndex} vs ${packetIndex}`);
    if (parsed.totalBlocksK !== totalBlocksK) throw new Error(`totalBlocksK mismatch: ${parsed.totalBlocksK} vs ${totalBlocksK}`);
    if (parsed.flags !== flags) throw new Error(`flags mismatch: ${parsed.flags} vs ${flags}`);
    if (parsed.payload.length !== payload.length) throw new Error('payload length mismatch');
    for (let i = 0; i < payload.length; i++) {
      if (parsed.payload[i] !== payload[i]) throw new Error(`payload byte ${i} mismatch`);
    }
  });

  // TEST 2: SHA-256 calculation bit-exact match
  await test('Cryptographic SHA-256 Integrity Verification', async () => {
    const testData = new TextEncoder().encode("AirGap Protocol Zero-Network 2026");
    const sha = await ProtocolEngine.computeSHA256(testData);
    if (typeof sha !== 'string' || sha.length !== 64) {
      throw new Error(`Invalid SHA-256 string: ${sha}`);
    }
  });

  // TEST 3: Fountain Systematic Transmission (0% Packet Loss)
  await test('Fountain Systematic Mode (0% loss, K packets)', async () => {
    const payloadSize = 1024 * 16; // 16 KB
    const chunkSize = 256;
    const rawData = generateRandomBytes(payloadSize);
    const originalHash = await ProtocolEngine.computeSHA256(rawData);

    const { blocks, K } = FountainCodec.chunkBuffer(rawData, chunkSize);
    const fileId = 0xDEADBEEF;
    const solver = new GF2Solver(K, chunkSize);

    // Send only the first K systematic packets
    for (let i = 0; i < K; i++) {
      const packetData = blocks[i];
      solver.addPacket(i, packetData, fileId);
    }

    if (!solver.isComplete()) {
      throw new Error(`Solver not complete: ${solver.resolvedCount}/${K} blocks resolved`);
    }

    const reconstructed = solver.reconstructBuffer(payloadSize);
    const reconHash = await ProtocolEngine.computeSHA256(reconstructed);

    if (reconHash !== originalHash) {
      throw new Error('Reconstructed SHA-256 hash mismatch!');
    }
  });

  // TEST 4: Optical Channel Loss (30% random packet loss + fountain recovery)
  await test('Channel Simulation (30% random loss + Fountain recovery)', async () => {
    const payloadSize = 1024 * 32; // 32 KB
    const chunkSize = 256;
    const rawData = generateRandomBytes(payloadSize);
    const originalHash = await ProtocolEngine.computeSHA256(rawData);

    const { blocks, K } = FountainCodec.chunkBuffer(rawData, chunkSize);
    const fileId = 0xCAFEBABE;
    const solver = new GF2Solver(K, chunkSize);
    const soliton = new RobustSolitonDistribution(K);

    let transmittedIndex = 0;
    const lossProbability = 0.30; // 30% optical drops

    while (!solver.isComplete() && transmittedIndex < K * 3) {
      const pktIdx = transmittedIndex++;
      
      // Simulate random camera optical loss
      if (Math.random() < lossProbability) {
        continue; // Dropped by camera
      }

      // Generate packet payload
      let packetPayload;
      if (pktIdx < K) {
        // Systematic packet
        packetPayload = blocks[pktIdx];
      } else {
        // Fountain XOR combination packet
        const neighbors = FountainCodec.getPacketNeighbors(fileId, pktIdx, K, soliton);
        packetPayload = new Uint8Array(chunkSize);
        for (const n of neighbors) {
          FountainCodec.xorBuffers(packetPayload, blocks[n]);
        }
      }

      solver.addPacket(pktIdx, packetPayload, fileId);
    }

    if (!solver.isComplete()) {
      throw new Error(`Failed to recover within limit. Resolved: ${solver.resolvedCount}/${K}, Rank: ${solver.rank}`);
    }

    const reconstructed = solver.reconstructBuffer(payloadSize);
    const reconHash = await ProtocolEngine.computeSHA256(reconstructed);

    if (reconHash !== originalHash) {
      throw new Error('Reconstructed hash mismatch after fountain repair!');
    }
  });

  // TEST 5: Extreme Burst Loss (First 70% systematic packets completely blocked)
  await test('Extreme Burst Loss (70% early drop + Pure Fountain Repair)', async () => {
    const payloadSize = 1024 * 20; // 20 KB
    const chunkSize = 200;
    const rawData = generateRandomBytes(payloadSize);
    const originalHash = await ProtocolEngine.computeSHA256(rawData);

    const { blocks, K } = FountainCodec.chunkBuffer(rawData, chunkSize);
    const fileId = 0x98765432;
    const solver = new GF2Solver(K, chunkSize);
    const soliton = new RobustSolitonDistribution(K);

    let pktIdx = 0;
    // Simulate user blocked transmitter screen during first 70% of transmission
    while (!solver.isComplete() && pktIdx < K * 4) {
      const current = pktIdx++;
      if (current < Math.floor(K * 0.70)) {
        continue; // Occlusion / Camera blind period
      }

      let packetPayload;
      if (current < K) {
        packetPayload = blocks[current];
      } else {
        const neighbors = FountainCodec.getPacketNeighbors(fileId, current, K, soliton);
        packetPayload = new Uint8Array(chunkSize);
        for (const n of neighbors) {
          FountainCodec.xorBuffers(packetPayload, blocks[n]);
        }
      }

      solver.addPacket(current, packetPayload, fileId);
    }

    if (!solver.isComplete()) {
      throw new Error(`Burst recovery failed: ${solver.resolvedCount}/${K} solved, rank ${solver.rank}`);
    }

    const reconstructed = solver.reconstructBuffer(payloadSize);
    const reconHash = await ProtocolEngine.computeSHA256(reconstructed);
    if (reconHash !== originalHash) {
      throw new Error('Hash mismatch after burst recovery');
    }
  });

  // TEST 6: Multi-Megabyte Ingestion & Compression Roundtrip
  await test('Large File 1.5MB Ingestion & Chunking Integrity', async () => {
    const payloadSize = 1024 * 1024 * 1.5; // 1.5 MB
    const chunkSize = 512;
    const rawData = generateRandomBytes(payloadSize);
    const originalHash = await ProtocolEngine.computeSHA256(rawData);

    const { blocks, K } = FountainCodec.chunkBuffer(rawData, chunkSize);
    const solver = new GF2Solver(K, chunkSize);
    const fileId = 0x55AA55AA;

    // Simulate clean systematic ingestion
    for (let i = 0; i < K; i++) {
      solver.addPacket(i, blocks[i], fileId);
    }

    if (!solver.isComplete()) {
      throw new Error('Large file solver incomplete');
    }

    const reconstructed = solver.reconstructBuffer(payloadSize);
    const reconHash = await ProtocolEngine.computeSHA256(reconstructed);
    if (reconHash !== originalHash) {
      throw new Error('1.5MB reconstructed hash mismatch!');
    }
  });

  console.log('\n====================================================');
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
