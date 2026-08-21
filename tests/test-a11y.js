const fs = require('fs');
const path = require('path');
const { I18N_DICTIONARY, I18nManager } = require('../js/i18n.js');

console.log('====================================================');
console.log('🧪 ACCESSIBILITY & I18N VERIFICATION SUITE');
console.log('====================================================');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`• ${message} ... ✅ PASSED`);
    passed++;
  } else {
    console.error(`• ${message} ... ❌ FAILED`);
    failed++;
  }
}

// Test 1: Verify key accessibility dictionary keys in both EN and IT
const requiredKeys = [
  'btnClearFileAriaLabel',
  'btnClearMergeAriaLabel',
  'btnClearOptAriaLabel',
  'txFpsSliderAriaLabel',
  'prefVolumeSliderAriaLabel',
  'btnStartTxTitleDisabled',
  'btnStartTxTitleEnabled'
];

requiredKeys.forEach(key => {
  assert(
    !!I18N_DICTIONARY.en[key],
    `English dictionary contains key "${key}"`
  );
  assert(
    !!I18N_DICTIONARY.it[key],
    `Italian dictionary contains key "${key}"`
  );
});

// Test 2: Verify HTML ARIA and data attributes in index.html
const htmlPath = path.join(__dirname, '../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

assert(
  html.includes('id="txFpsSlider"') && html.includes('role="slider"') && html.includes('data-i18n-aria-label="txFpsSliderAriaLabel"'),
  'txFpsSlider has role="slider" and data-i18n-aria-label'
);

assert(
  html.includes('id="prefVolumeSlider"') && html.includes('role="slider"') && html.includes('data-i18n-aria-label="prefVolumeSliderAriaLabel"'),
  'prefVolumeSlider has role="slider" and data-i18n-aria-label'
);

assert(
  html.includes('id="btnClearSplitFile"') && html.includes('data-i18n-aria-label="btnClearFileAriaLabel"'),
  'btnClearSplitFile icon button has data-i18n-aria-label'
);

assert(
  html.includes('id="btnStartTx"') && html.includes('data-i18n-title="btnStartTxTitleDisabled"'),
  'btnStartTx has initial data-i18n-title for state feedback'
);

// Test 3: Test I18nManager data-i18n-aria-label processing
const manager = new I18nManager();
const mockElement = {
  setAttributeCalls: [],
  getAttribute(attr) {
    if (attr === 'data-i18n-aria-label') return 'btnClearFileAriaLabel';
    return null;
  },
  setAttribute(attr, val) {
    this.setAttributeCalls.push({ attr, val });
  }
};

const mockRoot = {
  querySelectorAll(selector) {
    if (selector === '[data-i18n-aria-label]') {
      return [mockElement];
    }
    return [];
  }
};

manager.applyTranslations(mockRoot);
assert(
  mockElement.setAttributeCalls.some(call => call.attr === 'aria-label' && call.val === 'Clear selected file'),
  'I18nManager.applyTranslations successfully sets aria-label attribute'
);

console.log('\n====================================================');
console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
}
