/**
 * AirGap Protocol - Background Web Worker for Fountain Encoder
 * Performs non-blocking compression, SHA-256 calculation, chunking, and Soliton XOR sampling.
 */

// Import scripts if worker scope
if (typeof importScripts === 'function') {
  importScripts('./protocol.js', './fountain.js');
}

let session = null;

self.onmessage = async function(e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'INIT_ENCODER':
      try {
        const { fileBuffer, fileName, fileSize, mimeType, chunkSize, isCompressed } = payload;
        
        let dataBuffer = new Uint8Array(fileBuffer);
        const originalSha256 = await ProtocolEngine.computeSHA256(dataBuffer);

        let finalBuffer = dataBuffer;
        let compressed = false;

        if (isCompressed) {
          const comp = await ProtocolEngine.compress(dataBuffer);
          // Only use compression if it actually saved space
          if (comp.byteLength < dataBuffer.byteLength * 0.95) {
            finalBuffer = comp;
            compressed = true;
          }
        }

        const { blocks, K } = FountainCodec.chunkBuffer(finalBuffer, chunkSize);
        const fileId = ProtocolEngine.generateFileId(fileName, fileSize);
        const soliton = new RobustSolitonDistribution(K);

        const manifestBytes = ProtocolEngine.serializeManifest({
          fileName,
          fileSize,
          mimeType,
          sha256: originalSha256,
          chunkSize,
          totalBlocksK: K,
          isCompressed: compressed,
          origSize: fileSize
        });

        const manifestPacket = ProtocolEngine.serializePacket({
          fileId,
          packetIndex: 0xFFFFFFFF, // Special index for Manifest
          totalBlocksK: K,
          flags: FLAGS.MANIFEST,
          payload: manifestBytes
        });

        session = {
          fileId,
          fileName,
          fileSize,
          mimeType,
          originalSha256,
          chunkSize,
          totalBlocksK: K,
          blocks,
          soliton,
          manifestPacket,
          isCompressed: compressed,
          compressedSize: finalBuffer.byteLength
        };

        self.postMessage({
          type: 'ENCODER_READY',
          payload: {
            fileId,
            fileName,
            fileSize,
            origSize: fileSize,
            compressedSize: finalBuffer.byteLength,
            isCompressed: compressed,
            totalBlocksK: K,
            chunkSize,
            sha256: originalSha256
          }
        });
      } catch (err) {
        self.postMessage({
          type: 'ENCODER_ERROR',
          payload: { error: err.message }
        });
      }
      break;

    case 'GET_PACKET':
      if (!session) {
        self.postMessage({ type: 'ENCODER_ERROR', payload: { error: 'Encoder not initialized' } });
        return;
      }

      const { packetIndex, includeManifest } = payload;

      // Check if we should interleave Manifest packet
      if (includeManifest) {
        self.postMessage({
          type: 'PACKET_GENERATED',
          payload: {
            packetIndex: 0xFFFFFFFF,
            flags: FLAGS.MANIFEST,
            packetData: session.manifestPacket.buffer
          }
        }, [session.manifestPacket.buffer.slice(0)]);
        return;
      }

      const K = session.totalBlocksK;
      let packetFlags = 0;
      let packetPayload;

      if (packetIndex < K) {
        // Systematic packet
        packetFlags = FLAGS.SYSTEMATIC | (session.isCompressed ? FLAGS.COMPRESSED : 0);
        packetPayload = session.blocks[packetIndex];
      } else {
        // Fountain XOR combination packet
        packetFlags = FLAGS.FOUNTAIN | (session.isCompressed ? FLAGS.COMPRESSED : 0);
        const neighbors = FountainCodec.getPacketNeighbors(session.fileId, packetIndex, K, session.soliton);
        packetPayload = new Uint8Array(session.chunkSize);
        for (const n of neighbors) {
          FountainCodec.xorBuffers(packetPayload, session.blocks[n]);
        }
      }

      const serialized = ProtocolEngine.serializePacket({
        fileId: session.fileId,
        packetIndex,
        totalBlocksK: K,
        flags: packetFlags,
        payload: packetPayload
      });

      self.postMessage({
        type: 'PACKET_GENERATED',
        payload: {
          packetIndex,
          flags: packetFlags,
          packetData: serialized.buffer
        }
      }, [serialized.buffer]);
      break;

    case 'RESET_ENCODER':
      session = null;
      self.postMessage({ type: 'ENCODER_RESET_DONE' });
      break;
  }
};
