/**
 * AirGap Protocol - Background Web Worker for Fountain Decoder
 * Real-time Belief Propagation, GF(2) Matrix Gaussian Elimination,
 * Decompression and Cryptographic SHA-256 Verification.
 */

if (typeof importScripts === 'function') {
  importScripts('./protocol.js', './fountain.js');
}

let session = null;

function initSession(fileId, totalBlocksK, chunkSize) {
  session = {
    fileId,
    totalBlocksK,
    chunkSize,
    manifest: null,
    solver: new GF2Solver(totalBlocksK, chunkSize),
    packetsReceived: 0,
    startTime: Date.now(),
    lastFrameTime: Date.now(),
    isComplete: false
  };
}

self.onmessage = async function(e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'RESET_DECODER':
      session = null;
      self.postMessage({ type: 'DECODER_RESET_DONE' });
      break;

    case 'PROCESS_PACKET':
      try {
        const rawBytes = new Uint8Array(payload.rawBuffer);
        const packet = ProtocolEngine.deserializePacket(rawBytes);

        if (!packet) {
          self.postMessage({ type: 'PACKET_CORRUPTED' });
          return;
        }

        // Handle Manifest Packet
        if (packet.flags & FLAGS.MANIFEST) {
          const manifest = ProtocolEngine.deserializeManifest(packet.payload);
          if (manifest) {
            if (!session || session.fileId !== packet.fileId) {
              initSession(packet.fileId, manifest.totalBlocksK, manifest.chunkSize);
            }
            session.manifest = manifest;
            self.postMessage({
              type: 'MANIFEST_ACQUIRED',
              payload: {
                fileName: manifest.fileName,
                fileSize: manifest.fileSize,
                mimeType: manifest.mimeType,
                sha256: manifest.sha256,
                totalBlocksK: manifest.totalBlocksK,
                isCompressed: manifest.isCompressed
              }
            });
          }
          return;
        }

        // Data Packet (Systematic or Fountain)
        if (!session || session.fileId !== packet.fileId) {
          // Initialize solver on the fly with packet metadata
          initSession(packet.fileId, packet.totalBlocksK, packet.payloadLen);
        }

        session.packetsReceived++;
        session.lastFrameTime = Date.now();

        if (session.isComplete) {
          return;
        }

        const solverStatus = session.solver.addPacket(packet.packetIndex, packet.payload, packet.fileId);

        // Emit telemetry update
        self.postMessage({
          type: 'DECODER_PROGRESS',
          payload: {
            fileId: session.fileId,
            resolvedCount: solverStatus.resolvedCount,
            totalBlocksK: solverStatus.totalBlocksK,
            rank: solverStatus.rank,
            progressRatio: solverStatus.progressRatio,
            packetsReceived: session.packetsReceived,
            isComplete: solverStatus.isComplete
          }
        });

        // Check completion
        if (solverStatus.isComplete && !session.isComplete) {
          session.isComplete = true;
          const durationMs = Date.now() - session.startTime;

          // Reconstruct raw buffer
          let reconstructed = session.solver.reconstructBuffer();

          // Decompress if flag set
          if (session.manifest && session.manifest.isCompressed) {
            reconstructed = await ProtocolEngine.decompress(reconstructed);
          } else if (session.manifest && session.manifest.fileSize) {
            reconstructed = reconstructed.subarray(0, session.manifest.fileSize);
          }

          // Compute SHA-256
          const reconstructedSha = await ProtocolEngine.computeSHA256(reconstructed);
          const hashMatched = session.manifest ? (reconstructedSha.toLowerCase() === session.manifest.sha256.toLowerCase()) : true;

          self.postMessage({
            type: 'DECODING_COMPLETE',
            payload: {
              reconstructedBuffer: reconstructed.buffer,
              fileName: session.manifest ? session.manifest.fileName : `airgap-received-${session.fileId}.bin`,
              fileSize: reconstructed.byteLength,
              mimeType: session.manifest ? session.manifest.mimeType : 'application/octet-stream',
              sha256: reconstructedSha,
              expectedSha256: session.manifest ? session.manifest.sha256 : null,
              hashMatched,
              totalPacketsReceived: session.packetsReceived,
              durationMs
            }
          }, [reconstructed.buffer]);
        }
      } catch (err) {
        self.postMessage({
          type: 'DECODER_ERROR',
          payload: { error: err.message }
        });
      }
      break;
  }
};
