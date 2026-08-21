## 2025-02-21 - Unsanitized innerHTML Interpolation in Client Metadata Rendering
**Vulnerability:** DOM-based XSS via `innerHTML` string template interpolation of user-provided file metadata (`f.name`).
**Learning:** Constructing DOM structures with template literals inserting untrusted strings like file names into `innerHTML` allows HTML/script injection in client-side UI components.
**Prevention:** Always build DOM structures using `document.createElement()` and assign untrusted content strictly via `textContent` or element properties (`title`, `value`, etc.) rather than `innerHTML`.
