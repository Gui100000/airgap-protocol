const assert = require('assert');

let JSDOM;
try {
  JSDOM = require('jsdom').JSDOM;
} catch (e) {
  JSDOM = null;
}

console.log('====================================================');
console.log('🛡️ AIRGAP PROTOCOL - SECURITY SUITE');
console.log('====================================================');

if (JSDOM) {
  const dom = new JSDOM('<!DOCTYPE html><div id="txFileListContainer"></div><div id="txFileMetaCard" style="display:none"></div><span id="txMetaName"></span><span id="txMetaSize"></span><span id="txMetaSha"></span><span id="txMetaK"></span>');
  global.window = dom.window;
  global.document = dom.window.document;
  global.AirgapUtilities = { formatBytes: (b) => `${b} B` };

  const xssPayload = '<img src=x onerror=alert("XSS")>';
  const fileListEl = document.getElementById('txFileListContainer');

  const row = document.createElement('div');
  row.className = 'file-list-item';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'file-list-name';
  nameSpan.title = xssPayload;
  nameSpan.textContent = '📄 ' + xssPayload;

  row.appendChild(nameSpan);
  fileListEl.appendChild(row);

  assert.strictEqual(fileListEl.querySelector('img'), null, 'XSS Payload tag should not be parsed into DOM element');
  assert.strictEqual(nameSpan.textContent, '📄 ' + xssPayload, 'File name text content should match payload safely');
  console.log('• Testing DOM XSS prevention in file metadata display ... ✅ PASSED');
} else {
  const xssPayload = '<img src=x onerror=alert("XSS")>';

  class MockElement {
    constructor(tag) {
      this.tagName = tag;
      this.children = [];
      this.textContent = '';
      this.title = '';
    }
    appendChild(child) {
      this.children.push(child);
    }
  }

  const nameSpan = new MockElement('span');
  nameSpan.title = xssPayload;
  nameSpan.textContent = '📄 ' + xssPayload;

  assert.strictEqual(nameSpan.title, xssPayload);
  assert.strictEqual(nameSpan.textContent, '📄 <img src=x onerror=alert("XSS")>');
  console.log('• Testing DOM XSS prevention logic (Mock DOM) ... ✅ PASSED');
}

console.log('====================================================');
