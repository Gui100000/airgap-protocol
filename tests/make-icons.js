const fs = require('fs');
const path = require('path');

// 1x1 Cyan pixel PNG base64
const cyanPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const buf = Buffer.from(cyanPngBase64, 'base64');

fs.writeFileSync(path.join(__dirname, '../assets/icon-192.png'), buf);
fs.writeFileSync(path.join(__dirname, '../assets/icon-512.png'), buf);
console.log('PNG placeholder icons generated successfully.');
