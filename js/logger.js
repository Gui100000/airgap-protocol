/**
 * AirGap Protocol - Structured In-Memory Logger v2.3.0
 * 100% client-side, zero network leak, zero tracking.
 * Session-Relative Privacy Time (T+00:00.0) with reset on clear.
 */
class AirgapLogger {
  constructor(maxEntries = 2000) {
    this.maxEntries = maxEntries;
    this.entries = [];
    this.listeners = new Set();
    this.sessionStartTime = Date.now(); // Second 0
  }

  _formatSessionTime(timestampMs) {
    const deltaMs = Math.max(0, timestampMs - this.sessionStartTime);
    const totalSecs = Math.floor(deltaMs / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const tenths = Math.floor((deltaMs % 1000) / 100);
    return `T+${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
  }

  _addEntry(level, tag, message, data = null) {
    const now = Date.now();
    const entry = {
      id: now + '-' + Math.random().toString(36).substr(2, 6),
      timestampMs: now,
      sessionTime: this._formatSessionTime(now),
      level: level.toUpperCase(),
      tag: tag || 'SYSTEM',
      message: typeof message === 'string' ? message : JSON.stringify(message),
      data: data
    };

    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Notify UI log terminal
    this.listeners.forEach(fn => {
      try { fn(entry); } catch (e) { console.error('Log listener error:', e); }
    });

    const prefix = `[${entry.sessionTime}] [${entry.level}] [${entry.tag}]`;
    if (level === 'ERROR') {
      console.error(prefix, entry.message, data || '');
    } else if (level === 'WARN') {
      console.warn(prefix, entry.message, data || '');
    } else if (level === 'SUCCESS') {
      console.log(`%c${prefix} ${entry.message}`, 'color: #39ff14; font-weight: bold;', data || '');
    } else {
      console.log(prefix, entry.message, data || '');
    }

    return entry;
  }

  debug(tag, message, data) { return this._addEntry('DEBUG', tag, message, data); }
  info(tag, message, data) { return this._addEntry('INFO', tag, message, data); }
  success(tag, message, data) { return this._addEntry('SUCCESS', tag, message, data); }
  warn(tag, message, data) { return this._addEntry('WARN', tag, message, data); }
  error(tag, message, data) { return this._addEntry('ERROR', tag, message, data); }

  getEntries(filterLevel = null) {
    if (!filterLevel || filterLevel === 'ALL') return [...this.entries];
    return this.entries.filter(e => e.level === filterLevel.toUpperCase());
  }

  clear() {
    this.entries = [];
    this.sessionStartTime = Date.now(); // Reset session timer back to T+00:00.0!
    this.listeners.forEach(fn => {
      try { fn({ type: 'CLEAR' }); } catch (e) {}
    });
    this.info('SYSTEM', 'Log buffer cleared and session timer reset to T+00:00.0.');
  }

  subscribe(listenerFn) {
    this.listeners.add(listenerFn);
    return () => this.listeners.delete(listenerFn);
  }

  exportAsText() {
    return this.entries.map(e => {
      const meta = e.data ? ` | Data: ${JSON.stringify(e.data)}` : '';
      return `[${e.sessionTime}] [${e.level.padEnd(7)}] [${e.tag.padEnd(10)}] ${e.message}${meta}`;
    }).join('\n');
  }

  getExportDetails() {
    const text = this.exportAsText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const sizeKB = (blob.size / 1024).toFixed(2);
    return {
      text,
      blob,
      sizeBytes: blob.size,
      sizeKB,
      linesCount: this.entries.length,
      format: 'Plain Text (.LOG)'
    };
  }

  downloadLogFile() {
    const details = this.getExportDetails();
    const url = URL.createObjectURL(details.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `airgap-protocol-session-logs.log`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
    return details;
  }
}

const Logger = new AirgapLogger(2000);
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AirgapLogger, Logger };
} else if (typeof window !== 'undefined') {
  window.Logger = Logger;
}
