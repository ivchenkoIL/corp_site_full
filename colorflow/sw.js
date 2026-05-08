// ColorFlow service worker — app-shell cache + stale-while-revalidate.
// Bump APP_VERSION whenever you ship breaking changes to invalidate clients.

const APP_VERSION = 'cf-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/canvas.js',
  './js/ui.js',
  './js/storage.js',
  './assets/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== APP_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never intercept cross-origin (analytics, CDNs). Let the network handle it.
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(APP_VERSION);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      // Only cache successful, basic (same-origin) responses.
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    // Stale-while-revalidate: serve cache immediately, refresh in background.
    if (cached) {
      // Don't await network — let it update the cache for next time.
      network;
      return cached;
    }
    const fresh = await network;
    if (fresh) return fresh;
    // Last-resort offline page = the app shell itself.
    return cache.match('./index.html');
  })());
});

// Allow page to ask SW to update + reload.
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
