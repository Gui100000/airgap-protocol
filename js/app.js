/**
 * AirGap Protocol - Main Application Controller & UI State Machine v2.4.0
 * 100% Offline, Zero-Network, Real Mathematical Telemetry & Cyberpunk HUD.
 */

class AirgapApp {
  constructor() {
    this.txWorker = null;
    this.rxWorker = null;
    this.scanner = null;

    // Transmitter State
    this.txState = 'IDLE'; // IDLE, ENCODING, STREAMING, PAUSED, STOPPED
    this.txFiles = [];
    this.txMeta = null;
    this.txPacketIndex = 0;
    this.txTimer = null;
    this.txFps = 15;
    this.txChunkSize = 380;
    this.txEcc = 'M';
    this.txCompress = true;
    this.txStopAt100 = true;
    this.txStartTime = 0;
    this.txBytesStreamed = 0;

    // Receiver State
    this.rxState = 'STANDBY'; // STANDBY, SCANNING, RECEIVING, COMPLETED
    this.rxMeta = null;
    this.rxStartTime = 0;
    this.rxPacketsHistory = [];
    this.rxCompletedBlob = null;
    this.rxCompletedName = '';
    this.rxDroppedCount = 0;
    this.rxBlockMap = null;

    // Wake Lock
    this.wakeLock = null;

    // Audio & Preferences
    this.audioEnabled = false;
    this.audioVolume = 0.30;
    this.audioCtx = null;
  }

  async init() {
    Logger.info('SYSTEM', 'Initializing AirGap Protocol v2.4.0...');

    // Register Service Worker with Active Auto-Update Detection
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js');
        Logger.success('PWA', 'Cache-First Service Worker active. 100% offline isolation guaranteed.');

        // Proactively check for newer versions when online
        reg.update();

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                Logger.info('PWA', 'New application version detected. Updating cache...');
                newWorker.postMessage('SKIP_WAITING');
              }
            });
          }
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
        });
      } catch (err) {
        Logger.warn('PWA', 'Service worker registration note: ' + err.message);
      }
    }

    // Initialize i18n
    i18n.init();
    this._bindI18nButtons();

    // Initialize Web Workers
    this._initWorkers();

    // Initialize UI Elements & Event Listeners
    this._bindNavigation();
    this._bindTransmitterUI();
    this._bindReceiverUI();
    this._bindUtilitiesUI();
    this._bindSettingsAndLogs();
    this._bindClipboardPaste();

    // Initialize Logger Subscription
    this._initLogViewer();

    // Render Initial Interactive Test Pattern QR
    this._renderTestPattern();

    Logger.success('SYSTEM', 'AirGap Protocol ready. All cryptographic and fountain modules loaded.');
  }

  _vibrate(pattern) {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (e) {}
  }

  async _requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !this.wakeLock) {
        this.wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) {}
  }

  async _releaseWakeLock() {
    try {
      if (this.wakeLock) {
        await this.wakeLock.release();
        this.wakeLock = null;
      }
    } catch (e) {}
  }

  _initWorkers() {
    try {
      this.txWorker = new Worker('./js/worker-encoder.js');
      this.txWorker.onmessage = (e) => this._handleTxWorkerMessage(e.data);
      this.txWorker.onerror = (e) => Logger.error('TX_WORKER', e.message);

      this.rxWorker = new Worker('./js/worker-decoder.js');
      this.rxWorker.onmessage = (e) => this._handleRxWorkerMessage(e.data);
      this.rxWorker.onerror = (e) => Logger.error('RX_WORKER', e.message);
    } catch (e) {
      Logger.error('SYSTEM', 'Web Workers initialization failed: ' + e.message);
    }
  }

  // --- AUDIO SYNTHESIZER ---
  _playTone(freq, type = 'sine', duration = 0.05, baseGain = 0.05) {
    if (!this.audioEnabled || this.audioVolume <= 0) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      const finalGain = baseGain * this.audioVolume;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(finalGain, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {}
  }

  _playChimeSuccess() {
    this._vibrate([40, 60, 40, 60, 80]);
    if (!this.audioEnabled) return;
    this._playTone(523.25, 'triangle', 0.12, 0.15);
    setTimeout(() => this._playTone(659.25, 'triangle', 0.12, 0.15), 120);
    setTimeout(() => this._playTone(783.99, 'triangle', 0.15, 0.18), 240);
    setTimeout(() => this._playTone(1046.50, 'triangle', 0.35, 0.22), 360);
  }

  // --- I18N & THEME ---
  _bindI18nButtons() {
    const langBtn = document.getElementById('langToggleBtn');
    if (langBtn) {
      langBtn.addEventListener('click', () => {
        this._vibrate(10);
        const next = i18n.currentLang === 'it' ? 'en' : 'it';
        i18n.setLanguage(next);
        langBtn.textContent = next.toUpperCase();
        this._updateTxUIState();
        this._updateRxUIState();
        this._renderConstellation();
        if (this.txState === 'IDLE' && !this.txMeta) {
          this._renderTestPattern();
        }
      });
      langBtn.textContent = i18n.currentLang.toUpperCase();
    }
  }

  _bindNavigation() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this._vibrate(10);
        const targetTab = btn.getAttribute('data-tab');
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-panel').forEach(panel => {
          panel.classList.remove('active');
        });
        const targetPanel = document.getElementById(`panel-${targetTab}`);
        if (targetPanel) targetPanel.classList.add('active');

        if (targetTab !== 'rx' && this.scanner && this.scanner.isScanning) {
          this._stopReceiverCamera();
        }
      });
    });
  }

  _bindClipboardPaste() {
    document.addEventListener('paste', async (e) => {
      // If user pastes on transmitter tab
      const txPanel = document.getElementById('panel-tx');
      if (!txPanel || !txPanel.classList.contains('active')) return;

      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        this._vibrate(15);
        this._loadTxFiles(Array.from(e.clipboardData.files));
        Logger.info('TX', i18n.t('clipboardPastedNotice'));
      } else {
        const text = e.clipboardData.getData('text');
        if (text && text.trim().length > 0) {
          this._vibrate(15);
          const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
          const file = new File([blob], `pasted_text_${Date.now().toString().substr(-4)}.txt`, { type: 'text/plain' });
          this._loadTxFiles([file]);
          Logger.info('TX', i18n.t('clipboardPastedNotice'));
        }
      }
    });
  }

  // ==========================================
  // TRANSMITTER (TX) CONTROLLER
  // ==========================================
  _bindTransmitterUI() {
    const dropzone = document.getElementById('txDropzone');
    const fileInput = document.getElementById('txFileInput');
    const btnStart = document.getElementById('btnStartTx');
    const btnPause = document.getElementById('btnPauseTx');
    const btnStop = document.getElementById('btnStopTx');
    const btnStepNext = document.getElementById('btnStepNext');
    const btnStepPrev = document.getElementById('btnStepPrev');
    const btnReset = document.getElementById('btnResetTx');
    const fpsSlider = document.getElementById('txFpsSlider');
    const fpsVal = document.getElementById('txFpsVal');
    const fpsWarning = document.getElementById('txFpsWarning');
    const chunkSelect = document.getElementById('txChunkSizeSelect');
    const eccSelect = document.getElementById('txEccSelect');
    const compressToggle = document.getElementById('txCompressToggle');
    const stopAt100Toggle = document.getElementById('txStopAt100Toggle');

    // Locked settings notice during stream
    const lockedContainer = document.getElementById('txLockedSettingsArea');
    if (lockedContainer) {
      lockedContainer.addEventListener('click', (e) => {
        if (this.txState === 'STREAMING' || this.txState === 'PAUSED') {
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.closest('.toggle-switch')) {
            alert(i18n.t('settingsLockedToast'));
          }
        }
      });
    }

    // Drag & Drop
    ['dragenter', 'dragover'].forEach(name => {
      dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(name => {
      dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); });
    });
    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this._loadTxFiles(Array.from(e.dataTransfer.files));
      }
    });
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        this._loadTxFiles(Array.from(e.target.files));
      }
    });

    // Tuning Controls
    fpsSlider.addEventListener('input', (e) => {
      this.txFps = parseInt(e.target.value, 10);
      fpsVal.textContent = `${this.txFps} FPS`;
      if (this.txFps > 25) {
        fpsWarning.style.display = 'block';
        Logger.warn('TX', `High FPS selected (${this.txFps} FPS). May challenge slower smartphone cameras.`);
      } else {
        fpsWarning.style.display = 'none';
      }
      this._updateTxEta();
      if (this.txState === 'STREAMING') {
        this._restartTxTimer();
      }
    });

    chunkSelect.addEventListener('change', (e) => {
      this.txChunkSize = parseInt(e.target.value, 10);
      if (this.txFiles.length > 0) {
        this._reencodeTxFiles();
      } else {
        this._renderTestPattern();
      }
    });

    eccSelect.addEventListener('change', (e) => {
      this.txEcc = e.target.value;
      if (this.txMeta) {
        this._requestNextTxPacket();
      } else {
        this._renderTestPattern();
      }
    });

    compressToggle.addEventListener('change', (e) => {
      this.txCompress = e.target.checked;
      if (this.txFiles.length > 0) this._reencodeTxFiles();
    });

    stopAt100Toggle.addEventListener('change', (e) => {
      this.txStopAt100 = e.target.checked;
    });

    // Buttons
    btnStart.addEventListener('click', () => { this._vibrate(15); this._startTxStreaming(); });
    btnPause.addEventListener('click', () => { this._vibrate(15); this._pauseTxStreaming(); });
    btnStop.addEventListener('click', () => { this._vibrate(15); this._stopTxStreaming(); });
    btnStepNext.addEventListener('click', () => { this._vibrate(10); this._stepTxFrame(1); });
    btnStepPrev.addEventListener('click', () => { this._vibrate(10); this._stepTxFrame(-1); });
    btnReset.addEventListener('click', () => { this._vibrate(15); this._resetTx(); });
  }

  _renderTestPattern() {
    if (this.txMeta) return;
    const canvas = document.getElementById('txQrCanvas');
    if (!canvas) return;

    try {
      const demoPayload = new TextEncoder().encode(`AIRGAP PROTOCOL TEST PATTERN | ECC: ${this.txEcc} | DENSITY: ${this.txChunkSize}B | SYSTEMATIC GF(2)`);
      QREngine.render(demoPayload, canvas, {
        ecc: this.txEcc,
        size: 380,
        margin: 3
      });
    } catch (e) {}
  }

  async _loadTxFiles(fileList) {
    if (!fileList || fileList.length === 0) return;
    
    const mergedList = [...this.txFiles, ...fileList];
    this.txFiles = mergedList;

    let totalSize = this.txFiles.reduce((acc, f) => acc + f.size, 0);

    const warnBanner = document.getElementById('txSizeWarningBanner');
    const errBanner = document.getElementById('txSizeErrorBanner');
    warnBanner.style.display = 'none';
    errBanner.style.display = 'none';

    // Check > 100 MB Limit
    if (totalSize > 100 * 1024 * 1024) {
      const errText = i18n.t('errorOver100Mb', { size: AirgapUtilities.formatBytes(totalSize) });
      errBanner.textContent = errText;
      errBanner.style.display = 'block';
      Logger.error('TX', `Ingestion blocked: Total size (${AirgapUtilities.formatBytes(totalSize)}) exceeds 100 MB limit.`);
      this.txState = 'IDLE';
      this._updateTxUIState();
      return;
    } else if (totalSize > 30 * 1024 * 1024) {
      const warnText = i18n.t('warnOver30Mb');
      warnBanner.textContent = warnText;
      warnBanner.style.display = 'block';
      Logger.warn('TX', `Large file warning: ${AirgapUtilities.formatBytes(totalSize)} may take several minutes optically.`);
    }

    this.txState = 'ENCODING';
    this._updateTxUIState();

    let combinedBuffer;
    let fileName;
    let mimeType;

    if (this.txFiles.length === 1) {
      const f = this.txFiles[0];
      fileName = f.name;
      mimeType = f.type || 'application/octet-stream';
      combinedBuffer = await f.arrayBuffer();
    } else {
      fileName = `bundle_${this.txFiles.length}_files.airgap`;
      mimeType = 'application/x-airgap-bundle';
      
      const parts = [];
      for (const f of this.txFiles) {
        const buf = await f.arrayBuffer();
        const header = new TextEncoder().encode(JSON.stringify({ name: f.name, size: f.size, type: f.type }) + '\n--FILE--\n');
        parts.push(header, new Uint8Array(buf));
      }
      const combinedBlob = new Blob(parts);
      combinedBuffer = await combinedBlob.arrayBuffer();
      totalSize = combinedBuffer.byteLength;
    }

    Logger.info('TX', `File ingested: ${fileName} (${AirgapUtilities.formatBytes(totalSize)})`);

    this.txWorker.postMessage({
      type: 'INIT_ENCODER',
      payload: {
        fileBuffer: combinedBuffer,
        fileName,
        fileSize: totalSize,
        mimeType,
        chunkSize: this.txChunkSize,
        isCompressed: this.txCompress
      }
    }, [combinedBuffer]);
  }

  _removeFileAtIndex(index) {
    this._vibrate(10);
    this.txFiles.splice(index, 1);
    if (this.txFiles.length > 0) {
      this._reencodeTxFiles();
    } else {
      this._resetTx();
    }
  }

  _reencodeTxFiles() {
    if (this.txFiles.length > 0) {
      this._stopTxStreaming();
      const filesCopy = [...this.txFiles];
      this.txFiles = [];
      this._loadTxFiles(filesCopy);
    }
  }

  _handleTxWorkerMessage(msg) {
    const { type, payload } = msg;

    switch (type) {
      case 'ENCODER_READY':
        this.txMeta = payload;
        this.txPacketIndex = 0;
        this.txState = 'IDLE';
        this._displayTxMetadata(payload);
        this._updateTxUIState();
        this._updateTxEta();
        this._requestNextTxPacket();
        Logger.success('TX', `Fountain ready: K=${payload.totalBlocksK} blocks, SHA-256=${payload.sha256.substring(0, 16)}...`);
        break;

      case 'PACKET_GENERATED':
        this._renderTxPacket(payload);
        break;

      case 'ENCODER_ERROR':
        Logger.error('TX', 'Encoder error: ' + payload.error);
        this.txState = 'IDLE';
        this._updateTxUIState();
        break;
    }
  }

  _displayTxMetadata(meta) {
    const metaCard = document.getElementById('txFileMetaCard');
    const fileListEl = document.getElementById('txFileListContainer');
    
    fileListEl.innerHTML = '';
    this.txFiles.forEach((f, idx) => {
      const row = document.createElement('div');
      row.className = 'file-list-item';
      row.innerHTML = `
        <span class="file-list-name" title="${f.name}">📄 ${f.name}</span>
        <span class="file-list-size">${AirgapUtilities.formatBytes(f.size)}</span>
        <button class="btn-remove-file" data-idx="${idx}" title="Remove file">✖</button>
      `;
      row.querySelector('.btn-remove-file').addEventListener('click', (e) => {
        e.stopPropagation();
        this._removeFileAtIndex(idx);
      });
      fileListEl.appendChild(row);
    });

    const origFormatted = AirgapUtilities.formatBytes(meta.origSize);
    const compFormatted = AirgapUtilities.formatBytes(meta.compressedSize);
    const compSavings = meta.isCompressed ? ` → ${compFormatted} (-${Math.round((1 - meta.compressedSize / meta.origSize) * 100)}%)` : '';

    document.getElementById('txMetaName').textContent = meta.fileName;
    document.getElementById('txMetaSize').textContent = `${origFormatted}${compSavings}`;
    document.getElementById('txMetaSha').textContent = meta.sha256;
    document.getElementById('txMetaK').textContent = meta.totalBlocksK;
    metaCard.style.display = 'block';
  }

  _updateTxEta() {
    const etaEl = document.getElementById('txTelemetryEta');
    const durationWarn = document.getElementById('txDurationWarningBanner');
    if (!this.txMeta || this.txFps <= 0) {
      if (etaEl) etaEl.textContent = '0:00';
      if (durationWarn) durationWarn.style.display = 'none';
      return;
    }

    const totalSecs = Math.ceil(this.txMeta.totalBlocksK / this.txFps);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
    if (etaEl) etaEl.textContent = timeStr;

    if (totalSecs > 180 && durationWarn) {
      durationWarn.textContent = i18n.t('warnHighDuration', { duration: timeStr });
      durationWarn.style.display = 'block';
      Logger.warn('TX', `Estimated transmission duration is high (${timeStr}). Consider increasing FPS or compression.`);
    } else if (durationWarn) {
      durationWarn.style.display = 'none';
    }
  }

  _startTxStreaming() {
    if (!this.txMeta) return;
    this.txState = 'STREAMING';
    this.txStartTime = Date.now();
    this.txBytesStreamed = 0;
    this._requestWakeLock();
    this._updateTxUIState();
    this._restartTxTimer();
    Logger.info('TX', `Optical broadcast started at ${this.txFps} FPS.`);
  }

  _restartTxTimer() {
    if (this.txTimer) clearInterval(this.txTimer);
    const intervalMs = Math.max(16, Math.floor(1000 / this.txFps));
    this.txTimer = setInterval(() => {
      if (this.txStopAt100 && this.txMeta && this.txPacketIndex >= this.txMeta.totalBlocksK) {
        this._pauseTxStreaming();
        const statusText = document.getElementById('txStatusText');
        if (statusText) statusText.textContent = i18n.t('txStatusComplete100');
        return;
      }
      this._requestNextTxPacket();
      this.txPacketIndex++;
    }, intervalMs);
  }

  _pauseTxStreaming() {
    if (this.txState !== 'STREAMING') return;
    this.txState = 'PAUSED';
    if (this.txTimer) {
      clearInterval(this.txTimer);
      this.txTimer = null;
    }
    this._updateTxUIState();
    Logger.info('TX', `Transmission frozen at frame #${this.txPacketIndex}`);
  }

  _stopTxStreaming() {
    this.txState = 'STOPPED';
    if (this.txTimer) {
      clearInterval(this.txTimer);
      this.txTimer = null;
    }
    this.txPacketIndex = 0;
    this._releaseWakeLock();
    this._updateTxUIState();
    Logger.info('TX', 'Transmission stopped.');
  }

  _stepTxFrame(delta) {
    if (!this.txMeta) return;
    if (this.txTimer) {
      clearInterval(this.txTimer);
      this.txTimer = null;
    }
    this.txState = 'PAUSED';
    this.txPacketIndex = Math.max(0, this.txPacketIndex + delta);
    this._requestNextTxPacket();
    this._updateTxUIState();
  }

  _resetTx() {
    this._stopTxStreaming();
    this.txFiles = [];
    this.txMeta = null;
    this.txState = 'IDLE';
    this.txPacketIndex = 0;
    this.txBytesStreamed = 0;

    document.getElementById('txFileMetaCard').style.display = 'none';
    document.getElementById('txSizeWarningBanner').style.display = 'none';
    document.getElementById('txSizeErrorBanner').style.display = 'none';
    document.getElementById('txDurationWarningBanner').style.display = 'none';
    document.getElementById('txTelemetryPacket').textContent = '#0';
    document.getElementById('txTelemetryProgress').textContent = '0%';
    document.getElementById('txTelemetryFountain').textContent = '0';
    document.getElementById('txTelemetryRate').textContent = '0.0 KB/s';
    document.getElementById('txTelemetryEta').textContent = '0:00';

    const fileInput = document.getElementById('txFileInput');
    if (fileInput) fileInput.value = '';

    this._renderTestPattern();
    this._updateTxUIState();
    Logger.info('TX', 'Transmitter reset to clean state.');
  }

  _requestNextTxPacket() {
    if (!this.txWorker || !this.txMeta) return;
    
    // Frame 0 is the Manifest descriptor frame
    if (this.txPacketIndex === 0) {
      this.txWorker.postMessage({
        type: 'GET_PACKET',
        payload: {
          packetIndex: 0xFFFFFFFF,
          includeManifest: true
        }
      });
    } else {
      // Frame 1..K are Systematic data blocks 0..K-1; Frame >K are Fountain repair droplets
      const dataBlockIndex = this.txPacketIndex - 1;
      this.txWorker.postMessage({
        type: 'GET_PACKET',
        payload: {
          packetIndex: dataBlockIndex,
          includeManifest: false
        }
      });
    }
  }

  _renderTxPacket(packetPayload) {
    const rawUint8 = new Uint8Array(packetPayload.packetData);
    const canvas = document.getElementById('txQrCanvas');
    
    try {
      QREngine.render(rawUint8, canvas, {
        ecc: this.txEcc,
        size: 380,
        margin: 3
      });

      this.txBytesStreamed += rawUint8.byteLength;

      const pktEl = document.getElementById('txTelemetryPacket');
      const progEl = document.getElementById('txTelemetryProgress');
      const fountainEl = document.getElementById('txTelemetryFountain');
      const rateEl = document.getElementById('txTelemetryRate');

      const isManifest = (packetPayload.flags & FLAGS.MANIFEST) !== 0 || packetPayload.packetIndex === 0xFFFFFFFF;
      const K = this.txMeta.totalBlocksK;

      if (isManifest) {
        pktEl.textContent = 'MANIFEST';
        progEl.textContent = `0% (0/${K})`;
        fountainEl.textContent = '0';
      } else {
        const frameNum = packetPayload.packetIndex + 1;
        if (frameNum <= K) {
          pktEl.textContent = `#${frameNum}`;
          const pct = Math.min(100, Math.round((frameNum / K) * 100));
          progEl.textContent = `${pct}% (${frameNum}/${K})`;
          fountainEl.textContent = '0';
        } else {
          pktEl.textContent = `FOUNTAIN`;
          progEl.textContent = '100% (Completed)';
          const repairCount = frameNum - K;
          fountainEl.textContent = `+${repairCount}`;
        }
      }

      const elapsedSec = Math.max(0.1, (Date.now() - this.txStartTime) / 1000);
      const realRateKBs = ((this.txBytesStreamed / 1024) / elapsedSec).toFixed(1);
      rateEl.textContent = `${realRateKBs} KB/s`;

    } catch (e) {
      Logger.warn('TX', 'QR Rendering error: ' + e.message);
    }
  }

  _updateTxUIState() {
    const btnStart = document.getElementById('btnStartTx');
    const btnPause = document.getElementById('btnPauseTx');
    const btnStop = document.getElementById('btnStopTx');
    const statusText = document.getElementById('txStatusText');
    const fpsSlider = document.getElementById('txFpsSlider');
    const chunkSelect = document.getElementById('txChunkSizeSelect');
    const eccSelect = document.getElementById('txEccSelect');
    const compressToggle = document.getElementById('txCompressToggle');
    const stopAt100Toggle = document.getElementById('txStopAt100Toggle');

    const hasFile = !!this.txMeta;
    const isStreamingOrPaused = this.txState === 'STREAMING' || this.txState === 'PAUSED';

    btnStart.disabled = !hasFile || this.txState === 'STREAMING';
    btnPause.disabled = !hasFile || this.txState !== 'STREAMING';
    btnStop.disabled = !hasFile || !isStreamingOrPaused;

    fpsSlider.disabled = isStreamingOrPaused;
    chunkSelect.disabled = isStreamingOrPaused;
    eccSelect.disabled = isStreamingOrPaused;
    compressToggle.disabled = isStreamingOrPaused;
    stopAt100Toggle.disabled = isStreamingOrPaused;

    switch (this.txState) {
      case 'IDLE':
        statusText.textContent = hasFile ? i18n.t('txStatusIdle') : i18n.t('txStatusIdle');
        break;
      case 'ENCODING':
        statusText.textContent = i18n.t('txStatusEncoding');
        break;
      case 'STREAMING':
        statusText.textContent = i18n.t('txStatusStreaming');
        break;
      case 'PAUSED':
        statusText.textContent = i18n.t('txStatusPaused');
        break;
      case 'STOPPED':
        statusText.textContent = i18n.t('txStatusStopped');
        break;
    }
  }

  // ==========================================
  // RECEIVER (RX) CONTROLLER
  // ==========================================
  _bindReceiverUI() {
    const video = document.getElementById('rxVideo');
    const canvas = document.getElementById('rxProcessCanvas');
    const btnStartCam = document.getElementById('btnStartCam');
    const btnStopCam = document.getElementById('btnStopCam');
    const btnTorch = document.getElementById('btnTorchToggle');
    const btnInvert = document.getElementById('btnInvertToggle');
    const camSelect = document.getElementById('rxCameraSelect');
    const fileUpload = document.getElementById('rxSnapshotInput');
    const btnDownload = document.getElementById('btnDownloadReconstructed');

    this.scanner = new QRScanner(video, canvas, (packetBuffer) => {
      this._onOpticalPacketDetected(packetBuffer);
    });

    btnStartCam.addEventListener('click', async () => {
      this._vibrate(15);
      try {
        const deviceId = camSelect.value || null;
        await this.scanner.startCamera(deviceId);
        this.rxState = 'SCANNING';
        this._requestWakeLock();
        this._updateRxUIState();
        btnStartCam.style.display = 'none';
        btnStopCam.style.display = 'inline-block';
        Logger.info('RX', 'Optical video scanner started.');
        this._refreshCameraList();
      } catch (err) {
        Logger.error('RX', 'Camera permission error: ' + err.message);
        alert(i18n.t('errorCameraPermission'));
      }
    });

    btnStopCam.addEventListener('click', () => {
      this._vibrate(15);
      this._stopReceiverCamera();
    });

    btnTorch.addEventListener('click', async () => {
      this._vibrate(10);
      const active = await this.scanner.toggleTorch();
      btnTorch.classList.toggle('active', active);
      if (!active && !this.scanner.currentTrack?.getCapabilities?.()?.torch) {
        Logger.warn('RX', 'Torch/Flash not supported on this camera device.');
        alert(i18n.t('torchNotAvailable'));
      }
    });

    btnInvert.addEventListener('click', () => {
      this._vibrate(10);
      this.scanner.setInvertScanning(!this.scanner.isInverted);
      btnInvert.classList.toggle('active', this.scanner.isInverted);
    });

    camSelect.addEventListener('change', () => {
      if (this.scanner.isScanning) {
        this.scanner.startCamera(camSelect.value);
      }
    });

    fileUpload.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        const success = await this.scanner.scanImageFile(e.target.files[0]);
        if (!success) {
          Logger.warn('RX', 'No valid QR code detected in uploaded snapshot.');
        }
      }
    });

    btnDownload.addEventListener('click', () => {
      this._vibrate([20, 40, 20]);
      if (this.rxCompletedBlob) {
        const url = URL.createObjectURL(this.rxCompletedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.rxCompletedName || 'airgap-received.bin';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 200);
        Logger.success('RX', `Saved reconstructed file: ${a.download}`);
      }
    });
  }

  async _refreshCameraList() {
    const camSelect = document.getElementById('rxCameraSelect');
    const devices = await this.scanner.getCameraList();
    if (devices.length > 0) {
      camSelect.innerHTML = '';
      devices.forEach((d, idx) => {
        const opt = document.createElement('option');
        opt.value = d.deviceId;
        opt.textContent = d.label || `Camera ${idx + 1}`;
        camSelect.appendChild(opt);
      });
      camSelect.style.display = 'inline-block';
    }
  }

  _stopReceiverCamera() {
    if (this.scanner) {
      this.scanner.stopCamera();
    }
    this.rxState = 'STANDBY';
    this._releaseWakeLock();
    this._updateRxUIState();
    document.getElementById('btnStartCam').style.display = 'inline-block';
    document.getElementById('btnStopCam').style.display = 'none';
    Logger.info('RX', 'Optical scanner stopped.');
  }

  _onOpticalPacketDetected(rawUint8Array) {
    if (!this.rxWorker) return;

    if (this.rxState === 'STANDBY' || this.rxState === 'SCANNING') {
      this.rxState = 'RECEIVING';
      this.rxStartTime = Date.now();
      this._updateRxUIState();
    }

    this._vibrate(5);
    this._playTone(880, 'sine', 0.02, 0.04);
    this.rxPacketsHistory.push(Date.now());
    if (this.rxPacketsHistory.length > 30) this.rxPacketsHistory.shift();

    this.rxWorker.postMessage({
      type: 'PROCESS_PACKET',
      payload: { rawBuffer: rawUint8Array.buffer }
    }, [rawUint8Array.buffer]);
  }

  _handleRxWorkerMessage(msg) {
    const { type, payload } = msg;

    switch (type) {
      case 'MANIFEST_ACQUIRED':
        this.rxMeta = payload;
        this.rxBlockMap = new Uint8Array(payload.totalBlocksK);
        Logger.success('RX', `Manifest received: ${payload.fileName} (${AirgapUtilities.formatBytes(payload.fileSize)}, K=${payload.totalBlocksK})`);
        this._renderConstellation();
        break;

      case 'DECODER_PROGRESS':
        this._updateRxTelemetry(payload);
        break;

      case 'DECODING_COMPLETE':
        this._onDecodingComplete(payload);
        break;

      case 'PACKET_CORRUPTED':
        this.rxDroppedCount++;
        document.getElementById('rxTelemetryDropped').textContent = this.rxDroppedCount;
        Logger.warn('RX', `Corrupted optical frame dropped (#${this.rxDroppedCount}).`);
        break;

      case 'DECODER_ERROR':
        Logger.error('RX', 'Decoder error: ' + payload.error);
        break;
    }
  }

  _updateRxTelemetry(progress) {
    const { resolvedCount, totalBlocksK, rank } = progress;
    
    if (!this.rxBlockMap || this.rxBlockMap.length !== totalBlocksK) {
      this.rxBlockMap = new Uint8Array(totalBlocksK);
    }

    for (let i = 0; i < resolvedCount; i++) {
      if (!this.rxBlockMap[i]) this.rxBlockMap[i] = 1;
    }

    const missing = totalBlocksK - resolvedCount;
    document.getElementById('rxTelemetrySolved').textContent = `${resolvedCount} / ${totalBlocksK} (${Math.round((resolvedCount / totalBlocksK) * 100)}%)`;
    document.getElementById('rxTelemetryMissing').textContent = missing;
    
    const elapsedSec = Math.max(0.1, (Date.now() - this.rxStartTime) / 1000);
    const speedEl = document.getElementById('rxTelemetrySpeed');
    const etaEl = document.getElementById('rxTelemetryEta');
    const timeEl = document.getElementById('rxTelemetryElapsed');

    const totalBytes = resolvedCount * (this.rxMeta ? this.rxMeta.chunkSize || 380 : 380);
    const kbRate = (totalBytes / 1024 / elapsedSec).toFixed(1);
    speedEl.textContent = `${kbRate} KB/s`;

    if (this.rxPacketsHistory.length >= 5) {
      const windowSec = (this.rxPacketsHistory[this.rxPacketsHistory.length - 1] - this.rxPacketsHistory[0]) / 1000;
      const packetsPerSec = (this.rxPacketsHistory.length - 1) / Math.max(0.1, windowSec);
      if (packetsPerSec > 0 && missing > 0) {
        const remainingSec = Math.ceil(missing / packetsPerSec);
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        etaEl.textContent = `${mins}:${String(secs).padStart(2, '0')}`;
      } else {
        etaEl.textContent = '0:00';
      }
    }

    const eMins = Math.floor(elapsedSec / 60);
    const eSecs = Math.floor(elapsedSec % 60);
    timeEl.textContent = `${eMins}:${String(eSecs).padStart(2, '0')}`;

    this._renderConstellation();
  }

  _renderConstellation() {
    const canvas = document.getElementById('rxConstellationCanvas');
    if (!canvas || !this.rxBlockMap) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.clientWidth;
    const height = canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);

    const K = this.rxBlockMap.length;
    if (K === 0) return;

    const cols = Math.ceil(Math.sqrt(K * (width / height)));
    const rows = Math.ceil(K / cols);
    const cellW = width / cols;
    const cellH = height / rows;

    for (let i = 0; i < K; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * cellW;
      const y = row * cellH;

      const state = this.rxBlockMap[i];
      if (state === 1) {
        ctx.fillStyle = '#39ff14';
      } else if (state === 2) {
        ctx.fillStyle = '#00f0ff';
      } else {
        ctx.fillStyle = '#1c2128';
      }

      ctx.fillRect(x + 1, y + 1, Math.max(1, cellW - 2), Math.max(1, cellH - 2));
    }
  }

  _onDecodingComplete(result) {
    this.rxState = 'COMPLETED';
    this._releaseWakeLock();
    this._updateRxUIState();
    this._playChimeSuccess();

    this.rxCompletedBlob = new Blob([result.reconstructedBuffer], { type: result.mimeType });
    this.rxCompletedName = result.fileName;

    const banner = document.getElementById('rxCompletionBanner');
    const title = document.getElementById('rxCompletionTitle');
    const shaText = document.getElementById('rxCompletionSha');

    title.textContent = i18n.t('rxStatusComplete');
    shaText.textContent = `SHA-256: ${result.sha256} ${result.hashMatched ? '✓ (Bit-Exact)' : '⚠️ (Mismatch)'}`;
    banner.classList.add('active');

    Logger.success('RX', `100% RECOVERY COMPLETE in ${(result.durationMs / 1000).toFixed(2)}s! SHA-256: ${result.sha256}`);
  }

  _updateRxUIState() {
    const statusText = document.getElementById('rxStatusText');
    switch (this.rxState) {
      case 'STANDBY':
      case 'SCANNING':
        statusText.textContent = i18n.t('rxStatusWaiting');
        break;
      case 'RECEIVING':
        statusText.textContent = i18n.t('rxStatusReceiving');
        break;
      case 'COMPLETED':
        statusText.textContent = i18n.t('rxStatusComplete');
        break;
    }
  }

  // ==========================================
  // UTILITY SUITE
  // ==========================================
  _bindUtilitiesUI() {
    // 1. File Splitter
    const splitInput = document.getElementById('splitFileInput');
    const btnBrowseSplit = document.getElementById('btnBrowseSplit');
    const splitModeSelect = document.getElementById('splitModeSelect');
    const splitSizeArea = document.getElementById('splitSizeArea');
    const splitCountArea = document.getElementById('splitCountArea');
    const splitSize = document.getElementById('splitSizeInput');
    const splitUnit = document.getElementById('splitUnitSelect');
    const splitCount = document.getElementById('splitCountInput');
    const btnSplit = document.getElementById('btnRunSplit');
    const splitResults = document.getElementById('splitResultsArea');
    const btnClearSplit = document.getElementById('btnClearSplitFile');
    const splitFileNameDisplay = document.getElementById('splitFileNameDisplay');

    let currentSplitParts = [];

    if (btnBrowseSplit) {
      btnBrowseSplit.addEventListener('click', () => {
        this._vibrate(10);
        splitInput.click();
      });
    }

    if (splitModeSelect) {
      splitModeSelect.addEventListener('change', () => {
        if (splitModeSelect.value === 'count') {
          splitSizeArea.style.display = 'none';
          splitCountArea.style.display = 'block';
        } else {
          splitSizeArea.style.display = 'grid';
          splitCountArea.style.display = 'none';
        }
      });
    }

    splitInput.addEventListener('change', () => {
      if (splitInput.files && splitInput.files.length > 0) {
        splitFileNameDisplay.textContent = `📄 ${splitInput.files[0].name} (${AirgapUtilities.formatBytes(splitInput.files[0].size)})`;
        splitFileNameDisplay.style.display = 'block';
        if (btnClearSplit) btnClearSplit.style.display = 'inline-flex';
      }
    });

    if (btnClearSplit) {
      btnClearSplit.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._vibrate(10);
        splitInput.value = '';
        splitFileNameDisplay.textContent = '';
        splitFileNameDisplay.style.display = 'none';
        btnClearSplit.style.display = 'none';
        splitResults.innerHTML = '';
        currentSplitParts = [];
      });
    }

    btnSplit.addEventListener('click', async () => {
      this._vibrate(15);
      if (!splitInput.files || splitInput.files.length === 0) {
        alert(i18n.t('browseSingle'));
        return;
      }
      const file = splitInput.files[0];
      const isCountMode = splitModeSelect && splitModeSelect.value === 'count';

      try {
        let res;
        if (isCountMode) {
          const countVal = parseInt(splitCount.value, 10);
          if (isNaN(countVal) || countVal < 1 || countVal > 100) {
            Logger.error('TOOLS', 'Smart Split failed: count must be between 1 and 100.');
            alert(i18n.t('errorSplitCountRange'));
            return;
          }
          Logger.info('TOOLS', `Splitting ${file.name} into ${countVal} equal parts...`);
          res = await AirgapUtilities.splitFileByCount(file, countVal);
        } else {
          const val = parseFloat(splitSize.value);
          if (isNaN(val) || val < 1 || val > 1024) {
            Logger.error('TOOLS', 'Split failed: part size must be between 1 and 1024.');
            alert(i18n.t('errorSplitRange'));
            return;
          }
          const unit = splitUnit.value;
          Logger.info('TOOLS', `Splitting ${file.name} into ${val} ${unit} parts...`);
          res = await AirgapUtilities.splitFile(file, val, unit);
        }

        currentSplitParts = res.parts;

        // Generate instant 1-click ZIP package
        const zipBlob = await AirgapUtilities.createZipBundle(res.parts);
        const zipUrl = URL.createObjectURL(zipBlob);
        const zipName = `${file.name}_split_${res.totalParts}_parts.zip`;

        splitResults.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
            <strong>${res.totalParts} Parts Created (${AirgapUtilities.formatBytes(zipBlob.size)} Total):</strong>
            <a href="${zipUrl}" download="${zipName}" class="btn-primary" style="width:auto; padding:6px 14px; font-size:0.82rem; text-decoration:none; text-align:center;">
              ${i18n.t('downloadAllPartsZip')}
            </a>
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:6px;">${i18n.t('downloadSingleParts')}</div>
          <div id="splitLinksList"></div>
        `;

        const listEl = document.getElementById('splitLinksList');
        res.parts.forEach(p => {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(p.blob);
          link.download = p.name;
          link.textContent = `💾 ${p.name} (${AirgapUtilities.formatBytes(p.size)})`;
          link.className = 'btn-secondary';
          link.style.display = 'inline-block';
          link.style.margin = '3px 0';
          listEl.appendChild(link);
          listEl.appendChild(document.createElement('br'));
        });

        Logger.success('TOOLS', `File split successfully into ${res.totalParts} parts.`);
      } catch (err) {
        if (err.message === 'MAX_PARTS_EXCEEDED') {
          Logger.error('TOOLS', `Split failed: generated ${err.partCount} parts (exceeds max 100 limit).`);
          alert(i18n.t('errorSplitMaxParts', { count: err.partCount }));
        } else {
          Logger.error('TOOLS', 'Split error: ' + err.message);
          alert(i18n.t('errorSplitRange'));
        }
      }
    });

    // 2. File Merger
    const mergeInput = document.getElementById('mergePartsInput');
    const btnBrowseMerge = document.getElementById('btnBrowseMerge');
    const btnMerge = document.getElementById('btnRunMerge');
    const mergeResults = document.getElementById('mergeResultsArea');
    const btnClearMerge = document.getElementById('btnClearMergeFiles');
    const mergeFileNamesDisplay = document.getElementById('mergeFileNamesDisplay');

    if (btnBrowseMerge) {
      btnBrowseMerge.addEventListener('click', () => {
        this._vibrate(10);
        mergeInput.click();
      });
    }

    mergeInput.addEventListener('change', () => {
      if (mergeInput.files && mergeInput.files.length > 0) {
        mergeFileNamesDisplay.textContent = `📁 ${mergeInput.files.length} part files selected`;
        mergeFileNamesDisplay.style.display = 'block';
        if (btnClearMerge) btnClearMerge.style.display = 'inline-flex';
      }
    });

    if (btnClearMerge) {
      btnClearMerge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._vibrate(10);
        mergeInput.value = '';
        mergeFileNamesDisplay.textContent = '';
        mergeFileNamesDisplay.style.display = 'none';
        btnClearMerge.style.display = 'none';
        mergeResults.innerHTML = '';
      });
    }

    btnMerge.addEventListener('click', async () => {
      this._vibrate(15);
      if (!mergeInput.files || mergeInput.files.length === 0) {
        alert(i18n.t('browseMultiple'));
        return;
      }
      try {
        Logger.info('TOOLS', `Merging ${mergeInput.files.length} part files...`);
        const merged = await AirgapUtilities.mergeParts(Array.from(mergeInput.files));
        const url = URL.createObjectURL(merged.blob);

        let warnHtml = '';
        if (merged.hasUnnumberedFiles) {
          warnHtml = `<div style="background:rgba(255,183,3,0.15); border:1px solid var(--neon-amber); border-radius:6px; padding:8px; margin-top:8px; font-size:0.8rem; color:var(--neon-amber);">${i18n.t('errorMergerNoParts')}</div>`;
          Logger.warn('TOOLS', 'Merged files without .part1, .part2 naming.');
        }

        mergeResults.innerHTML = `
          <a href="${url}" download="${merged.name}" class="btn-primary" style="display:inline-block; margin-top:8px; text-decoration:none; text-align:center;">
            💾 SAVE ASSEMBLED FILE: ${merged.name} (${AirgapUtilities.formatBytes(merged.size)})
          </a>
          ${warnHtml}
        `;
        Logger.success('TOOLS', `Assembled unified file: ${merged.name}`);
      } catch (err) {
        if (err.message === 'MAX_100_PARTS') {
          Logger.error('TOOLS', 'Merge failed: exceeds 100 parts limit.');
          alert(i18n.t('errorMergerMax100'));
        } else {
          Logger.error('TOOLS', 'Merge error: ' + err.message);
          alert(err.message);
        }
      }
    });

    // 3. Image Optimizer
    const imgInput = document.getElementById('optImageInput');
    const btnBrowseOpt = document.getElementById('btnBrowseOpt');
    const qualityInput = document.getElementById('optQualityInput');
    const formatSelect = document.getElementById('optFormatSelect');
    const btnOpt = document.getElementById('btnRunOptImage');
    const optResults = document.getElementById('optResultsArea');
    const btnClearOpt = document.getElementById('btnClearOptImage');
    const optImageNameDisplay = document.getElementById('optImageNameDisplay');

    if (btnBrowseOpt) {
      btnBrowseOpt.addEventListener('click', () => {
        this._vibrate(10);
        imgInput.click();
      });
    }

    imgInput.addEventListener('change', () => {
      if (imgInput.files && imgInput.files.length > 0) {
        optImageNameDisplay.textContent = `🖼️ ${imgInput.files[0].name} (${AirgapUtilities.formatBytes(imgInput.files[0].size)})`;
        optImageNameDisplay.style.display = 'block';
        if (btnClearOpt) btnClearOpt.style.display = 'inline-flex';
      }
    });

    if (btnClearOpt) {
      btnClearOpt.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._vibrate(10);
        imgInput.value = '';
        optImageNameDisplay.textContent = '';
        optImageNameDisplay.style.display = 'none';
        btnClearOpt.style.display = 'none';
        optResults.innerHTML = '';
      });
    }

    btnOpt.addEventListener('click', async () => {
      this._vibrate(15);
      if (!imgInput.files || imgInput.files.length === 0) {
        alert(i18n.t('browseSingle'));
        return;
      }
      const file = imgInput.files[0];
      const rawQ = parseInt(qualityInput.value, 10);
      if (isNaN(rawQ) || rawQ < 10 || rawQ > 100) {
        Logger.error('TOOLS', 'Image optimization failed: Quality must be an integer between 10 and 100.');
        alert(i18n.t('errorQualityRange'));
        return;
      }
      const fmt = formatSelect.value;

      try {
        Logger.info('TOOLS', `Optimizing image ${file.name} to ${fmt}...`);
        const res = await AirgapUtilities.optimizeImage(file, rawQ, fmt);
        const url = URL.createObjectURL(res.blob);

        const percentText = res.isReduced ? `(-${res.percentChange}%)` : `(+${res.percentChange}% - larger than original)`;
        const valColor = res.isReduced ? 'var(--neon-green)' : 'var(--neon-amber)';

        optResults.innerHTML = `
          <div class="file-meta-row"><span class="file-meta-label">Original:</span><span class="file-meta-val">${AirgapUtilities.formatBytes(res.originalSize)}</span></div>
          <div class="file-meta-row"><span class="file-meta-label">Optimized:</span><span class="file-meta-val" style="color:${valColor}">${AirgapUtilities.formatBytes(res.optimizedSize)} ${percentText}</span></div>
          <a href="${url}" download="${res.name}" class="btn-primary" style="display:inline-block; margin-top:8px; text-decoration:none; text-align:center;">
            💾 SAVE OPTIMIZED IMAGE
          </a>
        `;
        Logger.success('TOOLS', `Image processed: ${percentText}`);
      } catch (err) {
        Logger.error('TOOLS', 'Image optimization error: ' + err.message);
        alert(i18n.t('errorQualityRange'));
      }
    });
  }

  // ==========================================
  // SETTINGS & LOGS
  // ==========================================
  _bindSettingsAndLogs() {
    const themeSelect = document.getElementById('prefThemeSelect');
    const soundToggle = document.getElementById('prefSoundToggle');
    const volumeSlider = document.getElementById('prefVolumeSlider');
    const volumeVal = document.getElementById('prefVolumeVal');
    const btnClearLogs = document.getElementById('btnClearLogs');
    const btnExportLogs = document.getElementById('btnExportLogs');
    const logFilter = document.getElementById('logsFilterSelect');

    themeSelect.addEventListener('change', (e) => {
      this._vibrate(10);
      document.body.setAttribute('data-theme', e.target.value);
    });

    soundToggle.addEventListener('change', (e) => {
      this._vibrate(10);
      this.audioEnabled = e.target.checked;
    });

    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        this.audioVolume = parseInt(e.target.value, 10) / 100;
        if (volumeVal) volumeVal.textContent = `${e.target.value}%`;
      });
    }

    btnClearLogs.addEventListener('click', () => {
      this._vibrate(15);
      if (confirm(i18n.t('confirmClearLogs'))) {
        Logger.clear();
      }
    });

    btnExportLogs.addEventListener('click', () => {
      this._vibrate(15);
      const details = Logger.downloadLogFile();
      alert(i18n.t('exportLogSuccess', { lines: details.linesCount, sizeKB: details.sizeKB, format: details.format }));
    });

    logFilter.addEventListener('change', () => {
      this._vibrate(10);
      this._refreshLogViewer();
    });
  }

  _initLogViewer() {
    const terminal = document.getElementById('logTerminal');
    Logger.subscribe((entry) => {
      if (entry.type === 'CLEAR') {
        terminal.innerHTML = '';
        return;
      }
      const filter = document.getElementById('logsFilterSelect').value;
      if (filter !== 'ALL' && entry.level !== filter) return;

      const line = document.createElement('div');
      line.className = `log-line ${entry.level}`;
      line.textContent = `[${entry.sessionTime}] [${entry.tag}] ${entry.message}`;
      terminal.appendChild(line);
      terminal.scrollTop = terminal.scrollHeight;
    });
  }

  _refreshLogViewer() {
    const terminal = document.getElementById('logTerminal');
    const filter = document.getElementById('logsFilterSelect').value;
    terminal.innerHTML = '';
    const entries = Logger.getEntries(filter);
    entries.forEach(entry => {
      const line = document.createElement('div');
      line.className = `log-line ${entry.level}`;
      line.textContent = `[${entry.sessionTime}] [${entry.tag}] ${entry.message}`;
      terminal.appendChild(line);
    });
    terminal.scrollTop = terminal.scrollHeight;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.app = new AirgapApp();
  window.app.init();
});
