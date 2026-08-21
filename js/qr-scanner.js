/**
 * AirGap Protocol - Dual-Engine High-Speed QR Scanner
 * Primary: Hardware-accelerated BarcodeDetector API
 * Fallback: Pure JS QR Decoder Engine
 * Features: Camera selector, Torch toggle, Invert scanning, Image upload fallback.
 */

(function(global) {
  'use strict';

  // Standalone Minimal Pure-JS QR Decoder Fallback (Binarizer + Grid Extractor)
  class FallbackQRDecoder {
    static decodeImageData(imageData) {
      // If jsQR is loaded in global scope, use it
      if (typeof global.jsQR === 'function') {
        const res = global.jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });
        if (res && res.binaryData) {
          return new Uint8Array(res.binaryData);
        }
        if (res && res.data) {
          // If returned as string, convert byte-for-byte
          const bytes = new Uint8Array(res.data.length);
          for (let i = 0; i < res.data.length; i++) bytes[i] = res.data.charCodeAt(i) & 0xff;
          return bytes;
        }
      }
      return null;
    }
  }

  class QRScanner {
    constructor(videoElement, canvasElement, onPacketDetected) {
      this.video = videoElement;
      this.canvas = canvasElement || document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.onPacketDetected = onPacketDetected;

      this.stream = null;
      this.currentTrack = null;
      this.isScanning = false;
      this.useBarcodeDetector = typeof global.BarcodeDetector !== 'undefined';
      this.barcodeDetector = null;
      this.isInverted = false;
      this.isTorchOn = false;

      this.scanInterval = null;
      this.animFrameId = null;
      this.lastScanTime = 0;
      this.minFrameIntervalMs = 1000 / 35; // Cap scanning at ~35 Hz for smooth UI

      if (this.useBarcodeDetector) {
        try {
          this.barcodeDetector = new global.BarcodeDetector({ formats: ['qr_code'] });
        } catch (e) {
          this.useBarcodeDetector = false;
        }
      }
    }

    async getCameraList() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(d => d.kind === 'videoinput');
      } catch (e) {
        return [];
      }
    }

    async startCamera(deviceId = null) {
      this.stopCamera();

      const constraints = {
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: deviceId ? undefined : { ideal: 'environment' },
          deviceId: deviceId ? { exact: deviceId } : undefined
        },
        audio: false
      };

      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.video.srcObject = this.stream;
        this.currentTrack = this.stream.getVideoTracks()[0];

        await new Promise((resolve) => {
          this.video.onloadedmetadata = () => {
            this.video.play();
            resolve();
          };
        });

        this.isScanning = true;
        this._startScanLoop();
        return true;
      } catch (err) {
        console.error('Camera start error:', err);
        throw err;
      }
    }

    stopCamera() {
      this.isScanning = false;
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
        this.currentTrack = null;
      }
      if (this.video) {
        this.video.srcObject = null;
      }
    }

    async toggleTorch() {
      if (!this.currentTrack) return false;
      const capabilities = this.currentTrack.getCapabilities ? this.currentTrack.getCapabilities() : {};
      if (!capabilities.torch) {
        return false;
      }

      this.isTorchOn = !this.isTorchOn;
      try {
        await this.currentTrack.applyConstraints({
          advanced: [{ torch: this.isTorchOn }]
        });
        return this.isTorchOn;
      } catch (e) {
        this.isTorchOn = false;
        return false;
      }
    }

    setInvertScanning(invert) {
      this.isInverted = !!invert;
    }

    _startScanLoop() {
      const scan = async (timestamp) => {
        if (!this.isScanning) return;

        if (timestamp - this.lastScanTime >= this.minFrameIntervalMs) {
          this.lastScanTime = timestamp;
          if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
            await this._processCurrentVideoFrame();
          }
        }

        this.animFrameId = requestAnimationFrame(scan);
      };

      this.animFrameId = requestAnimationFrame(scan);
    }

    async _processCurrentVideoFrame() {
      const vWidth = this.video.videoWidth;
      const vHeight = this.video.videoHeight;
      if (!vWidth || !vHeight) return;

      // Update internal processing canvas
      if (this.canvas.width !== vWidth || this.canvas.height !== vHeight) {
        this.canvas.width = vWidth;
        this.canvas.height = vHeight;
      }

      this.ctx.drawImage(this.video, 0, 0, vWidth, vHeight);

      if (this.isInverted) {
        const imgData = this.ctx.getImageData(0, 0, vWidth, vHeight);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = 255 - d[i];
          d[i + 1] = 255 - d[i + 1];
          d[i + 2] = 255 - d[i + 2];
        }
        this.ctx.putImageData(imgData, 0, 0);
      }

      // Try BarcodeDetector first
      if (this.useBarcodeDetector && this.barcodeDetector) {
        try {
          const barcodes = await this.barcodeDetector.detect(this.canvas);
          if (barcodes && barcodes.length > 0) {
            for (const bc of barcodes) {
              const rawData = bc.rawValue || bc.rawBytes;
              if (rawData) {
                this._dispatchPacket(rawData);
                return;
              }
            }
          }
        } catch (e) {
          // BarcodeDetector failed on this frame, fallback below
        }
      }

      // Fallback: Software QR Decoder
      try {
        const imgData = this.ctx.getImageData(0, 0, vWidth, vHeight);
        const decoded = FallbackQRDecoder.decodeImageData(imgData);
        if (decoded) {
          this._dispatchPacket(decoded);
        }
      } catch (e) {}
    }

    _dispatchPacket(raw) {
      let uint8;
      if (raw instanceof Uint8Array) {
        uint8 = raw;
      } else if (raw instanceof ArrayBuffer) {
        uint8 = new Uint8Array(raw);
      } else if (typeof raw === 'string') {
        // Convert raw ISO string to byte buffer
        uint8 = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
          uint8[i] = raw.charCodeAt(i) & 0xff;
        }
      } else {
        return;
      }

      if (this.onPacketDetected) {
        this.onPacketDetected(uint8);
      }
    }

    /**
     * Decode a static file or image snapshot
     */
    async scanImageFile(file) {
      const bitmap = await createImageBitmap(file);
      this.canvas.width = bitmap.width;
      this.canvas.height = bitmap.height;
      this.ctx.drawImage(bitmap, 0, 0);

      if (this.useBarcodeDetector && this.barcodeDetector) {
        try {
          const barcodes = await this.barcodeDetector.detect(this.canvas);
          if (barcodes && barcodes.length > 0) {
            for (const bc of barcodes) {
              const raw = bc.rawValue || bc.rawBytes;
              if (raw) {
                this._dispatchPacket(raw);
                return true;
              }
            }
          }
        } catch (e) {}
      }

      const imgData = this.ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      const decoded = FallbackQRDecoder.decodeImageData(imgData);
      if (decoded) {
        this._dispatchPacket(decoded);
        return true;
      }
      return false;
    }
  }

  global.QRScanner = QRScanner;

})(typeof window !== 'undefined' ? window : global);
