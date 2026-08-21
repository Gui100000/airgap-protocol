/**
 * AirGap Protocol - Air-Gapped Utility Suite v2.4.0
 * 100% in-memory processing:
 * - Smart File Splitter (By Size KB/MB & By Count 1..100)
 * - Zero-Dependency Micro-ZIP Bundler (1-click download of all parts)
 * - File Part Merger (up to 100 parts with validation)
 * - Image Optimizer (Integer 10..100 quality)
 */

class AirgapUtilities {
  /**
   * Slices a large file into fixed KB or MB chunks using File.slice().
   * Enforces max 100 parts limit and strict 1-1024 range.
   */
  static async splitFile(file, partSizeVal = 5, unit = 'MB', onProgress = null) {
    let numericVal = parseFloat(partSizeVal);
    if (isNaN(numericVal) || numericVal < 1 || numericVal > 1024) {
      throw new Error('INVALID_RANGE');
    }

    if (unit === 'KB' && numericVal >= 1024) {
      numericVal = numericVal / 1024;
      unit = 'MB';
    }

    let partSizeBytes = (unit === 'KB') 
      ? Math.floor(numericVal * 1024) 
      : Math.floor(numericVal * 1024 * 1024);

    partSizeBytes = Math.max(1024, partSizeBytes); // minimum 1 KB

    const totalParts = Math.ceil(file.size / partSizeBytes);
    if (totalParts > 100) {
      const err = new Error('MAX_PARTS_EXCEEDED');
      err.partCount = totalParts;
      throw err;
    }

    return this._generateParts(file, partSizeBytes, totalParts, onProgress);
  }

  /**
   * Smart File Splitter: divides file into exactly N equal parts (1..100).
   */
  static async splitFileByCount(file, numParts = 4, onProgress = null) {
    const n = parseInt(numParts, 10);
    if (isNaN(n) || n < 1 || n > 100) {
      throw new Error('INVALID_PARTS_COUNT');
    }

    const partSizeBytes = Math.max(1, Math.ceil(file.size / n));
    const totalParts = Math.min(n, Math.ceil(file.size / partSizeBytes));

    return this._generateParts(file, partSizeBytes, totalParts, onProgress);
  }

  static async _generateParts(file, partSizeBytes, totalParts, onProgress) {
    const parts = [];
    for (let i = 0; i < totalParts; i++) {
      const start = i * partSizeBytes;
      const end = Math.min(start + partSizeBytes, file.size);
      const sliceBlob = file.slice(start, end);
      const partName = `${file.name}.part${i + 1}`;
      
      parts.push({
        index: i + 1,
        totalParts,
        name: partName,
        blob: sliceBlob,
        size: sliceBlob.size
      });

      if (onProgress) {
        onProgress((i + 1) / totalParts, i + 1, totalParts);
      }
    }

    return {
      originalName: file.name,
      originalSize: file.size,
      totalParts,
      parts
    };
  }

  /**
   * Zero-Dependency Pure JS In-Memory ZIP Bundler.
   * Packages all part files into a single standard .zip file without compression overhead.
   */
  static async createZipBundle(files) {
    // files: Array of { name: string, blob: Blob }
    const fileEntries = [];
    let offset = 0;

    for (const f of files) {
      const arrayBuf = await f.blob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuf);
      const nameBytes = new TextEncoder().encode(f.name);
      
      // Calculate CRC-32
      const crc = AirgapUtilities._crc32(uint8);

      fileEntries.push({
        name: f.name,
        nameBytes,
        data: uint8,
        crc,
        size: uint8.length,
        offset
      });

      // Local header size: 30 + nameBytes.length + data.length
      offset += 30 + nameBytes.length + uint8.length;
    }

    // Build the ZIP binary structure
    const zipParts = [];

    // 1. Local File Headers + File Data
    for (const entry of fileEntries) {
      const header = new Uint8Array(30 + entry.nameBytes.length);
      const view = new DataView(header.buffer);
      
      view.setUint32(0, 0x04034b50, true); // Local file header signature
      view.setUint16(4, 20, true);         // Version needed to extract (2.0)
      view.setUint16(6, 0, true);          // General purpose bit flag
      view.setUint16(8, 0, true);          // Compression method (0 = Store)
      view.setUint16(10, 0x4821, true);    // Last mod file time
      view.setUint16(12, 0x546b, true);    // Last mod file date
      view.setUint32(14, entry.crc, true); // CRC-32
      view.setUint32(18, entry.size, true);// Compressed size
      view.setUint32(22, entry.size, true);// Uncompressed size
      view.setUint16(26, entry.nameBytes.length, true); // File name length
      view.setUint16(28, 0, true);         // Extra field length
      header.set(entry.nameBytes, 30);

      zipParts.push(header);
      zipParts.push(entry.data);
    }

    const centralDirStart = offset;
    let centralDirSize = 0;

    // 2. Central Directory Headers
    for (const entry of fileEntries) {
      const cdHeader = new Uint8Array(46 + entry.nameBytes.length);
      const view = new DataView(cdHeader.buffer);

      view.setUint32(0, 0x02014b50, true); // Central directory file header signature
      view.setUint16(4, 20, true);         // Version made by
      view.setUint16(6, 20, true);         // Version needed to extract
      view.setUint16(8, 0, true);          // General purpose bit flag
      view.setUint16(10, 0, true);         // Compression method (0 = Store)
      view.setUint16(12, 0x4821, true);    // Last mod file time
      view.setUint16(14, 0x546b, true);    // Last mod file date
      view.setUint32(16, entry.crc, true); // CRC-32
      view.setUint32(20, entry.size, true);// Compressed size
      view.setUint32(24, entry.size, true);// Uncompressed size
      view.setUint16(28, entry.nameBytes.length, true); // File name length
      view.setUint16(30, 0, true);         // Extra field length
      view.setUint16(32, 0, true);         // File comment length
      view.setUint16(34, 0, true);         // Disk number start
      view.setUint16(36, 0, true);         // Internal file attributes
      view.setUint32(38, 0, true);         // External file attributes
      view.setUint32(42, entry.offset, true); // Relative offset of local header
      cdHeader.set(entry.nameBytes, 46);

      zipParts.push(cdHeader);
      centralDirSize += cdHeader.length;
    }

    // 3. End of Central Directory Record
    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
    eocdView.setUint16(4, 0, true);          // Number of this disk
    eocdView.setUint16(6, 0, true);          // Disk where central directory starts
    eocdView.setUint16(8, fileEntries.length, true);  // Number of central directory records on this disk
    eocdView.setUint16(10, fileEntries.length, true); // Total number of central directory records
    eocdView.setUint32(12, centralDirSize, true);     // Size of central directory
    eocdView.setUint32(16, centralDirStart, true);    // Offset of start of central directory
    eocdView.setUint16(20, 0, true);                  // Comment length

    zipParts.push(eocd);

    return new Blob(zipParts, { type: 'application/zip' });
  }

  static _crc32(uint8Array) {
    let crc = ~0;
    for (let i = 0; i < uint8Array.length; i++) {
      crc ^= uint8Array[i];
      for (let j = 0; j < 8; j++) {
        crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
      }
    }
    return (crc ^ ~0) >>> 0;
  }

  /**
   * Merges multiple slice parts in correct numerical order (.part1, .part2, .part3...)
   */
  static async mergeParts(partFiles, onProgress = null) {
    if (!partFiles || partFiles.length === 0) {
      throw new Error('NO_FILES');
    }
    if (partFiles.length > 100) {
      throw new Error('MAX_100_PARTS');
    }

    let hasUnnumberedFiles = false;
    for (const f of partFiles) {
      if (!/\.part\d+$/i.test(f.name)) {
        hasUnnumberedFiles = true;
      }
    }

    const sorted = [...partFiles].sort((a, b) => {
      const matchA = a.name.match(/\.part(\d+)$/i);
      const matchB = b.name.match(/\.part(\d+)$/i);
      if (matchA && matchB) {
        return parseInt(matchA[1], 10) - parseInt(matchB[1], 10);
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    const total = sorted.length;
    const blobs = [];
    let totalSize = 0;

    for (let i = 0; i < total; i++) {
      blobs.push(sorted[i]);
      totalSize += sorted[i].size;
      if (onProgress) {
        onProgress((i + 1) / total, i + 1, total);
      }
    }

    const mergedBlob = new Blob(blobs, { type: 'application/octet-stream' });
    
    let origName = sorted[0].name.replace(/\.part\d+$/i, '');
    if (origName === sorted[0].name) {
      origName = `merged_${sorted[0].name}`;
    }

    return {
      name: origName,
      size: mergedBlob.size,
      blob: mergedBlob,
      hasUnnumberedFiles
    };
  }

  /**
   * Optimizes an image to reduce optical payload.
   * Validates integer quality strictly between 10 and 100.
   */
  static async optimizeImage(imageFile, qualityVal = 80, format = 'image/webp', maxDimension = 1920) {
    const intQ = parseInt(qualityVal, 10);
    if (isNaN(intQ) || intQ < 10 || intQ > 100) {
      throw new Error('INVALID_QUALITY_RANGE');
    }
    const qRatio = intQ / 100;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(imageFile);

      img.onload = () => {
        URL.revokeObjectURL(url);
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas image conversion failed'));
            return;
          }

          const ext = format === 'image/webp' ? 'webp' : 'jpg';
          const baseName = imageFile.name.replace(/\.[^/.]+$/, '');
          const newName = `${baseName}_optimized.${ext}`;

          const delta = (imageFile.size - blob.size) / imageFile.size;
          const isReduced = blob.size < imageFile.size;

          resolve({
            name: newName,
            originalSize: imageFile.size,
            optimizedSize: blob.size,
            isReduced,
            percentChange: Math.round(Math.abs(delta) * 100),
            savingsRatio: delta,
            blob
          });
        }, format, qRatio);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image file'));
      };

      img.src = url;
    });
  }

  static formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AirgapUtilities };
} else if (typeof window !== 'undefined') {
  window.AirgapUtilities = AirgapUtilities;
}
