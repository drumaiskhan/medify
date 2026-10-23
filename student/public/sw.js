// MEDIFY service worker: keeps the app itself available offline.
// It deliberately NEVER touches API calls: notes and images are saved by the app
// (see src/lib/offline.ts) so they can be wiped on logout and expire with the subscription.
const VERSION = 'medify-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/config.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('medify-shell-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never intercept the API, or anything under /api.
  if (url.pathname.startsWith('/api/')) return;

  // Deployment settings: always try the network first so a changed API address is picked up.
  if (url.pathname === '/config.js') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Page loads: network first, saved app shell when offline (single-page app).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put('/index.html', copy));
        return res;
      }).catch(() => caches.match('/index.html'))
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  const isStatic = sameOrigin && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/pdf-assets/') || /\.(js|css|woff2?|png|jpg|jpeg|webp|svg|ico|wasm|json|webmanifest)$/.test(url.pathname));
  if (!isStatic && !isFont) return;

  // Static files: serve the saved copy instantly, refresh it in the background.
  event.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req).then((hit) => {
        const refresh = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || refresh;
      })
    )
  );
});
