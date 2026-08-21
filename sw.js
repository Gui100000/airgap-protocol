/**
 * AirGap Protocol - Service Worker v2.4.0
 * 100% Offline PWA with Instant Auto-Update on Reconnect
 */

const CACHE_NAME = 'airgap-cache-v2.4.0';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './assets/logo.jpg',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './js/logger.js',
  './js/i18n.js',
  './js/protocol.js',
  './js/fountain.js',
  './js/qr-engine.js',
  './js/jsqr.js',
  './js/qr-scanner.js',
  './js/utilities.js',
  './js/worker-encoder.js',
  './js/worker-decoder.js',
  './js/app.js'
];

// Install: Cache all core assets immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate: Delete any outdated caches immediately and claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Listen for SKIP_WAITING message
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Strategy: Network-First for HTML (to get fresh updates when online), Cache-First for static assets
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // For HTML documents / root navigation: Network-First with Cache fallback
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('./index.html') || caches.match(event.request);
        })
    );
    return;
  }

  // For all other static assets (CSS, JS, Images): Cache-First with Network fallback
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
