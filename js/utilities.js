/**
 * AirGap Protocol - Air-Gapped Utility Suite v2.3.0
 * 100% in-memory processing: File Splitter (Max 100 parts, KB/MB), File Merger & Image Optimizer.
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

    // Auto-convert >1024 KB to MB
    if (unit === 'KB' && numericVal >= 1024) {
      numericVal = numericVal / 1024;
      unit = 'MB';
    }

    let partSizeBytes;
    if (unit === 'KB') {
      partSizeBytes = Math.floor(numericVal * 1024);
    } else {
      partSizeBytes = Math.floor(numericVal * 1024 * 1024);
    }

    partSizeBytes = Math.max(1024, partSizeBytes); // minimum 1 KB

    const totalParts = Math.ceil(file.size / partSizeBytes);
    if (totalParts > 100) {
      const err = new Error('MAX_PARTS_EXCEEDED');
      err.partCount = totalParts;
      throw err;
    }

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
   * Merges multiple slice parts in correct numerical order (.part1, .part2, .part3...)
   * Validates max 100 parts and checks for standard part numbering.
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
   * Optimizes an image (rescales / re-encodes to WebP or JPEG) to reduce optical payload.
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
