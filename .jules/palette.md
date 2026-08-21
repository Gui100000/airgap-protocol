## 2025-08-21 - Accessible Custom Controls & Bilingual ARIA Labels
**Learning:** Custom UI controls (icon buttons, range sliders, disabled state buttons) in vanilla JS/HTML applications require dynamic ARIA attributes (`role="slider"`, `aria-valuenow`, `data-i18n-aria-label`) integrated with the i18n translation system. Explicit `:focus-visible` ring indicators provide seamless keyboard navigation without affecting mouse clicks.
**Action:** Always include `data-i18n-aria-label` handling in `I18nManager` when adding translated accessibility descriptions, and verify via `tests/test-a11y.js`.
