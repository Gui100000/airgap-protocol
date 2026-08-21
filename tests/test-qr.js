const { QREngine } = require('../js/qr-engine.js');

console.log('Testing QREngine with various payload sizes...');

const testSizes = [64, 180, 256, 380, 512, 768];
const eccLevels = ['L', 'M', 'Q', 'H'];

for (const size of testSizes) {
  const dummyData = new Uint8Array(size);
  for (let i = 0; i < size; i++) dummyData[i] = (i * 37) & 0xff;

  for (const ecc of eccLevels) {
    try {
      const qr = QREngine.generate(dummyData, { ecc });
      console.log(`✅ Size: ${size}B, ECC: ${ecc} -> Generated QR Version ${qr.typeNumber} (${qr.moduleCount}x${qr.moduleCount})`);
    } catch (e) {
      console.error(`❌ Failed Size: ${size}B, ECC: ${ecc} -> ${e.message}`);
    }
  }
}
