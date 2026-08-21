/**
 * AirGap Protocol - Bilingual Translation Dictionary (EN / IT) v2.4.0
 * 100% offline, reactive i18n manager with dynamic key substitution.
 * Defaults to English (EN) on first visit, with instant toggle to Italian (IT).
 */
const I18N_DICTIONARY = {
  en: {
    // Header & Meta
    appTitle: "AirGap Protocol",
    appSubtitle: "Systematic Fountain Code Optical Bridge",
    offlineStatus: "100% AIR-GAPPED (OFFLINE)",
    tabTransmitter: "Transmitter (TX)",
    tabReceiver: "Receiver (RX)",
    tabUtilities: "Utility Suite",
    tabLogs: "System Logs",
    tabSettings: "Settings & Info",

    // Common Buttons & Labels
    browseFiles: "Browse File(s)",
    browseSingle: "Select File",
    browseMultiple: "Select Part Files",
    noFileSelected: "No file selected",
    filesSelectedCount: "{count} file(s) selected",
    downloadAllPartsZip: "📦 DOWNLOAD ALL PARTS (.ZIP)",
    downloadSingleParts: "Download Individual Parts:",

    // Transmitter
    txTitle: "High-Speed Optical Transmitter",
    txSubtitle: "Encodes binary files into animated QR fountain code streams.",
    dropzonePrompt: "Drag & Drop file(s) here, paste clipboard (Ctrl+V), or browse",
    dropzoneHint: "Supports single or multiple files (up to 30 MB recommended, max 100 MB)",
    fileDetails: "File Ingestion Details",
    fileListTitle: "Files in Current Transfer:",
    fileName: "File Name",
    fileSize: "Total Size",
    fileSha256: "SHA-256 Checksum",
    chunksTotal: "Total Blocks (K)",
    chunkSizeLabel: "Block Density",
    chunkSizeHelp: "Amount of data per QR. Medium is optimal for most cameras.",
    speedFpsLabel: "Frame Rate (QR / sec)",
    eccLabel: "Error Correction (ECC)",
    eccHelp: "Helps receiver scan in low light, reflections or motion blur.",
    compressLabel: "Dynamic Compression (Deflate)",
    stopAt100Label: "Stop automatically at 100% (Systematic blocks)",
    txEtaLabel: "Estimated Duration",
    btnStartTx: "START STREAM",
    btnPauseTx: "PAUSE / FREEZE",
    btnResumeTx: "RESUME STREAM",
    btnStopTx: "STOP STREAM",
    btnStepNext: "STEP +1",
    btnStepPrev: "STEP -1",
    btnResetTx: "RESET FILE",
    txStatusIdle: "Demo test pattern displayed. Select a file to initialize fountain encoder.",
    txStatusEncoding: "Preparing blocks and computing fountain distribution...",
    txStatusStreaming: "Streaming visual QR packets...",
    txStatusPaused: "Transmission paused. Target frame frozen on display.",
    txStatusStopped: "Transmission stopped.",
    txStatusComplete100: "100% Systematic frames transmitted. Stream paused at 100%.",
    txPacketCounter: "Current Frame",
    txProgressPercent: "Systematic Progress",
    txFountainGenerated: "Repair Packets Emitted",
    txRealRate: "Effective Rate",
    warnOver30Mb: "⚠️ Notice: Files over 30 MB may take several minutes to transfer optically. Consider splitting.",
    errorOver100Mb: "🛑 Error: Total file size ({size}) exceeds 100 MB limit. Please use 'Utility Suite' -> 'Split File' to transfer in smaller parts.",
    warnHighDuration: "⏱️ Warning: Estimated duration is high ({duration}). Tip: Increase FPS or enable compression to speed up transfer.",
    settingsLockedToast: "🔒 Settings are locked during active transmission. Click 'Reset File' to change settings or frame rate.",
    clipboardPastedNotice: "📋 Pasted payload from clipboard loaded successfully.",

    // Receiver
    rxTitle: "High-Speed Optical Receiver",
    rxSubtitle: "Real-time Belief Propagation & GF(2) Gaussian Elimination decoder.",
    cameraSelect: "Select Video Source",
    cameraStart: "START CAMERA SCANNER",
    cameraStop: "STOP CAMERA",
    torchToggle: "TORCH / FLASH",
    torchNotAvailable: "Torch/Flash not supported on this device/front camera",
    invertToggle: "INVERT COLORS (DARK MODE)",
    rxUploadFallback: "Upload QR Snapshot / Image",
    rxUploadFallbackHelp: "If camera is blocked or unavailable, you can upload photos of the QR codes.",
    rxTargetHint: "Align camera with the transmitter screen",
    telemetryTitle: "Live Transmission Telemetry",
    rxBlocksSolved: "Blocks Solved (Rank)",
    rxMissingBlocks: "Blocks Missing",
    rxDroppedFrames: "Corrupted Frames",
    rxOpticalSpeed: "Instantaneous Speed",
    rxTrueEta: "Mathematical ETA",
    rxElapsedTime: "Elapsed Time",
    rxConstellationTitle: "Fountain Block Constellation (GF(2) Matrix)",
    legendSystematic: "Systematic (Raw)",
    legendFountain: "Fountain (Repaired)",
    legendMissing: "Pending / Missing",
    rxStatusWaiting: "Awaiting valid OPTX-v2 optical packets...",
    rxStatusReceiving: "Receiving packets. Solving linear equations in Web Worker...",
    rxStatusComplete: "100% RECONSTRUCTION COMPLETE! SHA-256 Verified Bit-Exact.",
    btnDownload: "SAVE RECONSTRUCTED FILE",
    rxVerificationPassed: "Cryptographic SHA-256 Hash Matched",
    rxVerificationFailed: "CRITICAL: SHA-256 Integrity Mismatch!",

    // Utilities
    toolsTitle: "Air-Gapped Utility Suite",
    toolsSubtitle: "Offline processing tools for payload splitting, merging, and image compression.",
    splitterTitle: "Smart File Splitter",
    splitterDesc: "Divide large files into segments (.part1, .part2) by exact size or into N equal parts.",
    splitModeLabel: "Split Mode:",
    splitBySize: "By Part Size (KB / MB)",
    splitByCount: "By Number of Parts (1 - 100)",
    splitUnitLabel: "Part Unit",
    splitSizeLabel: "Part Size (1 - 1024):",
    splitCountLabel: "Number of Equal Parts (1 - 100):",
    btnSplit: "SPLIT FILE",
    errorSplitRange: "Invalid value: please enter a number between 1 and 1024.",
    errorSplitMaxParts: "Limit exceeded: this part size would generate {count} parts. Max allowed limit is 100 parts. Please increase part size.",
    errorSplitCountRange: "Invalid count: enter an integer number of parts between 1 and 100.",
    mergerTitle: "File Part Merger",
    mergerDesc: "Recombine multi-part slice files (.part1, .part2) into the original unified file (up to 100 parts).",
    btnMerge: "MERGE PARTS",
    errorMergerNoParts: "⚠️ Some uploaded files do not have .part1, .part2 naming. Tip: You can use 'Split File', upload your file with a part size larger than the file, and you will get .part1 to merge with your other parts.",
    errorMergerMax100: "Limit exceeded: maximum 100 parts can be merged at once.",
    imageOptTitle: "Image Size Optimizer",
    imageOptDesc: "Re-encode high-res images to compressed WebP/JPEG locally to maximize QR transfer speed.",
    optQuality: "Target Quality (Integer 10 - 100%):",
    optFormat: "Target Format",
    btnOptimizeImage: "OPTIMIZE IMAGE",
    errorQualityRange: "Invalid quality: please enter an integer between 10 and 100.",
    inspectorTitle: "Binary & Hex Inspector",
    inspectorDesc: "Inspect binary headers, entropy, and SHA-256 checksums locally.",

    // Settings & Logs
    settingsTitle: "Configuration & Privacy",
    privacyNote: "Zero network connectivity. 100% Client-Side. No telemetry, no cookies, no tracking.",
    prefLanguage: "Interface Language",
    prefTheme: "HUD Visual Theme",
    themeDefault: "Cyber Cyan (Default)",
    themeMatrix: "Matrix Emerald",
    themeAmber: "Amber Terminal",
    themeCrimson: "Crimson Protocol",
    prefSound: "Audio Feedback Beeps",
    prefVolume: "Beep Volume (%)",
    logsTitle: "System Event & Security Logs",
    logsFilter: "Filter Level",
    logsAll: "All Events",
    logsDebug: "Debug (Gray)",
    logsInfo: "Info (Cyan)",
    logsSuccess: "Success (Green)",
    logsWarn: "Warnings (Amber)",
    logsError: "Errors (Red)",
    btnClearLogs: "CLEAR LOGS",
    btnExportLogs: "EXPORT LOG FILE (.LOG)",
    confirmClearLogs: "Are you sure you want to clear the entire log buffer and reset the session timer?",
    exportLogSuccess: "Log exported: {lines} entries ({sizeKB} KB) in {format} format.",
    aboutFooterText: "• Systematic Luby Transform & RaptorQ-inspired Fountain Codes over GF(2)<br/>• 20-Byte OPTX-v2 Little-Endian Wire Header Framing<br/>• Zero Cloud / Zero CDN / Pure Client-Side CSP (connect-src 'none')<br/>• Session-Relative Privacy Timestamps (T+00:00.0)<br/>• Open Source MIT License",

    // Modals & General
    close: "CLOSE",
    confirm: "CONFIRM",
    cancel: "CANCEL",
    copied: "Copied to clipboard!",
    errorCameraPermission: "Camera access was denied or not available. Use file snapshot upload or grant camera permissions.",
    unsupportedBrowser: "Your browser does not support required Web Worker or Stream APIs. Please use a modern browser."
  },
  it: {
    // Header & Meta
    appTitle: "AirGap Protocol",
    appSubtitle: "Ponte Ottico a Codici a Fontana Sistematici",
    offlineStatus: "100% ISOLATO (OFFLINE AIR-GAP)",
    tabTransmitter: "Trasmettitore (TX)",
    tabReceiver: "Ricevitore (RX)",
    tabUtilities: "Suite Strumenti",
    tabLogs: "Log di Sistema",
    tabSettings: "Impostazioni & Info",

    // Common Buttons & Labels
    browseFiles: "Sfoglia File",
    browseSingle: "Seleziona File",
    browseMultiple: "Seleziona Parti",
    noFileSelected: "Nessun file selezionato",
    filesSelectedCount: "{count} file selezionati",
    downloadAllPartsZip: "📦 SCARICA TUTTE LE PARTI (.ZIP)",
    downloadSingleParts: "Scarica Singole Parti:",

    // Transmitter
    txTitle: "Trasmettitore Ottico ad Alta Velocità",
    txSubtitle: "Codifica file binari in stream visivi di codici QR a fontana senza limiti di tempo.",
    dropzonePrompt: "Trascina qui i file, incolla da appunti (Ctrl+V) o seleziona",
    dropzoneHint: "Supporta file singoli o multipli (consigliato fino a 30 MB, max 100 MB)",
    fileDetails: "Dettagli File Acquisito",
    fileListTitle: "File nel Trasferimento Corrente:",
    fileName: "Nome File",
    fileSize: "Dimensione Totale",
    fileSha256: "Checksum SHA-256",
    chunksTotal: "Blocchi Totali (K)",
    chunkSizeLabel: "Densità Blocco",
    chunkSizeHelp: "Quantità di dati per QR. Medio è consigliato per la maggior parte delle fotocamere.",
    speedFpsLabel: "Frequenza Frame (QR / sec)",
    eccLabel: "Correzione Errore (ECC)",
    eccHelp: "Aiuta il ricevitore a scansionare con poca luce, riflessi o vibrazioni.",
    compressLabel: "Compressione Dinamica (Deflate)",
    stopAt100Label: "Arresta automaticamente al 100% (Blocchi sistematici)",
    txEtaLabel: "Durata Stimata",
    btnStartTx: "AVVIA STREAMING",
    btnPauseTx: "PAUSA / FERMA FRAME",
    btnResumeTx: "RIPRENDI STREAMING",
    btnStopTx: "INTERROMPI TRASMISSIONE",
    btnStepNext: "PASSO +1",
    btnStepPrev: "PASSO -1",
    btnResetTx: "REIMPOSTA FILE",
    txStatusIdle: "QR Code dimostrativo attivo. Seleziona un file per inizializzare l'encoder a fontana.",
    txStatusEncoding: "Suddivisione in blocchi e calcolo distribuzioni Soliton...",
    txStatusStreaming: "Trasmissione visiva pacchetti QR in corso...",
    txStatusPaused: "Trasmissione in pausa. Frame corrente bloccato a schermo.",
    txStatusStopped: "Trasmissione interrotta.",
    txStatusComplete100: "100% dei blocchi sistematici trasmessi. Flusso in pausa al 100%.",
    txPacketCounter: "Frame Corrente",
    txProgressPercent: "Progresso Sistematico",
    txFountainGenerated: "Pacchetti Riparazione Emessi",
    txRealRate: "Velocità Ottica Effettiva",
    warnOver30Mb: "⚠️ Avviso: File superiori a 30 MB possono richiedere diversi minuti. Considera di comprimere o dividere il file.",
    errorOver100Mb: "🛑 Errore: La dimensione totale ({size}) supera il limite massimo di 100 MB. Usa 'Suite Strumenti' -> 'Dividi File' per trasmetterlo in parti più piccole.",
    warnHighDuration: "⏱️ Attenzione: Durata stimata elevata ({duration}). Suggerimento: aumenta gli FPS o attiva la compressione.",
    settingsLockedToast: "🔒 Le impostazioni sono bloccate durante la trasmissione attiva. Clicca su 'Reimposta File' per modificarle.",
    clipboardPastedNotice: "📋 Dati incollati dagli appunti caricati con successo.",

    // Receiver
    rxTitle: "Ricevitore Ottico ad Alta Velocità",
    rxSubtitle: "Decodifica in tempo reale con Belief Propagation ed Eliminazione Gaussiana su GF(2).",
    cameraSelect: "Seleziona Fotocamera",
    cameraStart: "ATTIVA FOTOCAMERA",
    cameraStop: "DISATTIVA FOTOCAMERA",
    torchToggle: "TORCIA / FLASH",
    torchNotAvailable: "Torcia/Flash non disponibile su questo dispositivo / fotocamera frontale",
    invertToggle: "INVERTI COLORI (DARK MODE)",
    rxUploadFallback: "Carica Frame QR / Immagine",
    rxUploadFallbackHelp: "Se non hai la fotocamera o è bloccata, puoi caricare foto scattate ai QR code.",
    rxTargetHint: "Inquadra lo schermo del trasmettitore nel mirino",
    telemetryTitle: "Telemetria Trasferimento Live",
    rxBlocksSolved: "Blocchi Risolti (Rango)",
    rxMissingBlocks: "Blocchi Mancanti",
    rxDroppedFrames: "Frame Corrotti",
    rxOpticalSpeed: "Velocità Istantanea",
    rxTrueEta: "Tempo Stimato (ETA)",
    rxElapsedTime: "Tempo Trascorso",
    rxConstellationTitle: "Costellazione Blocchi Fontana (Matrice GF(2))",
    legendSystematic: "Sistematico (Grezzo)",
    legendFountain: "Fontana (Riparato)",
    legendMissing: "In Attesa / Mancante",
    rxStatusWaiting: "In attesa di pacchetti ottici OPTX-v2 validi...",
    rxStatusReceiving: "Ricezione pacchetti. Risoluzione equazioni lineari nel Web Worker...",
    rxStatusComplete: "RICOSTRUZIONE 100% COMPLETATA! SHA-256 Verificato Bit-Exact.",
    btnDownload: "SALVA FILE RICOSTRUITO",
    rxVerificationPassed: "Hash Crittografico SHA-256 Confermato",
    rxVerificationFailed: "CRITICO: Mancata corrispondenza di integrità SHA-256!",

    // Utilities
    toolsTitle: "Suite Utility Offline",
    toolsSubtitle: "Strumenti di elaborazione locale per divisione file, unione e compressione immagini.",
    splitterTitle: "Divisione File Intelligente",
    splitterDesc: "Dividi file voluminosi per dimensione fissa o in esattamente N parti uguali.",
    splitModeLabel: "Modalità di Divisione:",
    splitBySize: "Per Dimensione Parte (KB / MB)",
    splitByCount: "Per Numero di Parti Uguali (1 - 100)",
    splitUnitLabel: "Unità Misura",
    splitSizeLabel: "Dimensione Parte (1 - 1024):",
    splitCountLabel: "Numero di Parti Uguali (1 - 100):",
    btnSplit: "DIVIDI FILE",
    errorSplitRange: "Valore non valido: inserisci un numero compreso tra 1 e 1024.",
    errorSplitMaxParts: "Limite superato: questa dimensione genererebbe {count} parti. Il limite massimo è 100 parti. Aumenta la dimensione delle parti.",
    errorSplitCountRange: "Conteggio non valido: inserisci un numero intero di parti compreso tra 1 e 100.",
    mergerTitle: "Unione Parti di File",
    mergerDesc: "Ricomponi file divisi in parti (.part1, .part2) nel file originale completo (fino a 100 parti).",
    btnMerge: "UNISCI PARTI",
    errorMergerNoParts: "⚠️ Alcuni file non contengono la dicitura .part1, .part2. Suggerimento: puoi usare 'Dividi File' con dimensione maggiore del file stesso per ottenere .part1 e unirlo alle altre parti.",
    errorMergerMax100: "Limite superato: è possibile unire al massimo 100 parti contemporaneamente.",
    imageOptTitle: "Ottimizzatore Dimensioni Immagini",
    imageOptDesc: "Ricodifica immagini ad alta risoluzione in WebP/JPEG compresso localmente per velocizzare il QR.",
    optQuality: "Qualità Target (Intero 10 - 100%):",
    optFormat: "Formato Target",
    btnOptimizeImage: "OTTIMIZZA IMMAGINE",
    errorQualityRange: "Qualità non valida: inserisci un numero intero compreso tra 10 e 100.",
    inspectorTitle: "Analizzatore Binario ed Esadecimale",
    inspectorDesc: "Ispeziona intestazioni binarie, entropia e checksum SHA-256 localmente.",

    // Settings & Logs
    settingsTitle: "Configurazione & Riservatezza",
    privacyNote: "Nessuna connessione di rete. 100% Client-Side. Zero telemetria, zero cookie, zero tracciamento.",
    prefLanguage: "Lingua Interfaccia",
    prefTheme: "Tema Cyberpunk HUD",
    themeDefault: "Cyber Ciano (Predefinito)",
    themeMatrix: "Matrix Smeraldo",
    themeAmber: "Terminale Ambra",
    themeCrimson: "Crimson Protocol",
    prefSound: "Segnali Acustici di Notifica",
    prefVolume: "Volume Notifiche (%)",
    logsTitle: "Log di Sistema ed Eventi di Sicurezza",
    logsFilter: "Filtra per Livello",
    logsAll: "Tutti gli Eventi",
    logsDebug: "Debug (Grigio)",
    logsInfo: "Informazioni (Ciano)",
    logsSuccess: "Successi (Verde)",
    logsWarn: "Avvisi (Ambra)",
    logsError: "Errori (Rosso)",
    btnClearLogs: "CANCELLA LOG",
    btnExportLogs: "ESPORTA LOG (.LOG)",
    confirmClearLogs: "Sei sicuro di voler cancellare tutti i log e azzerare il timer di sessione?",
    exportLogSuccess: "Log esportato: {lines} voci ({sizeKB} KB) in formato {format}.",
    aboutFooterText: "• Codici a Fontana Sistematici Luby Transform & RaptorQ su GF(2)<br/>• Framing Intestazione Binaria OPTX-v2 da 20 Byte Little-Endian<br/>• Zero Cloud / Zero CDN / CSP Isolato a Livello Client (connect-src 'none')<br/>• Timestamp Privacy Relativi alla Sessione (T+00:00.0)<br/>• Licenza Open Source MIT",

    // Modals & General
    close: "CHIUDI",
    confirm: "CONFERMA",
    cancel: "ANNULLA",
    copied: "Copiato negli appunti!",
    errorCameraPermission: "Accesso alla fotocamera negato o non disponibile. Usa il caricamento file o concedi l'autorizzazione.",
    unsupportedBrowser: "Il tuo browser non supporta i Web Worker o le Stream API richieste. Utilizza un browser moderno."
  }
};

class I18nManager {
  constructor() {
    this.currentLang = 'en'; // Default to English
    this.listeners = new Set();
  }

  init() {
    try {
      const stored = localStorage.getItem('airgap_lang');
      if (stored && (stored === 'en' || stored === 'it')) {
        this.currentLang = stored;
      } else {
        this.currentLang = 'en'; // Default first-visit language is English
      }
    } catch (e) {
      this.currentLang = 'en';
    }
    this.applyTranslations();
  }

  setLanguage(lang) {
    if (lang !== 'en' && lang !== 'it') return;
    this.currentLang = lang;
    try {
      localStorage.setItem('airgap_lang', lang);
    } catch (e) {}
    this.applyTranslations();
    this.listeners.forEach(fn => {
      try { fn(this.currentLang); } catch (e) {}
    });
  }

  t(key, params = {}) {
    const dict = I18N_DICTIONARY[this.currentLang] || I18N_DICTIONARY.en;
    let text = dict[key] || I18N_DICTIONARY.en[key] || key;
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`{${k}}`, 'g'), v);
    }
    return text;
  }

  applyTranslations(rootElement = document) {
    const elements = rootElement.querySelectorAll('[data-i18n]');
    elements.forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) {
        if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit')) {
          el.value = this.t(key);
        } else {
          el.innerHTML = this.t(key);
        }
      }
    });

    const inputs = rootElement.querySelectorAll('[data-i18n-placeholder]');
    inputs.forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) {
        el.placeholder = this.t(key);
      }
    });

    const titled = rootElement.querySelectorAll('[data-i18n-title]');
    titled.forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) {
        el.title = this.t(key);
      }
    });

    document.documentElement.lang = this.currentLang;
  }

  subscribe(listenerFn) {
    this.listeners.add(listenerFn);
    return () => this.listeners.delete(listenerFn);
  }
}

const i18n = new I18nManager();
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { I18N_DICTIONARY, I18nManager, i18n };
} else if (typeof window !== 'undefined') {
  window.i18n = i18n;
}
