/* Gan-si SW v14: network-first app shell; public data SWR; private APIs never cached. */
const CACHE_VERSION = 'sur-sadhana-v14';
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/themes.css',
  '/css/responsive.css',
  '/css/material.css',
  '/style.css',
  '/audio-engine.js',
  '/pitch-detector.js',
  '/app.js',
  '/js/music/swara.js',
  '/js/music/pitch-filters.js',
  '/js/music/pitch-history.js',
  '/js/music/raga-engine.js',
  '/js/audio/tabla.js',
  '/js/audio/tanpura.js',
  '/js/practice/guided-practice.js',
  '/js/practice/raga-learning.js',
  '/js/practice/vocal-range.js',
  '/js/practice/alankar-generator.js',
  '/js/practice/analytics.js',
  '/js/practice/ear-training.js',
  '/js/ui/auth.js',
  '/js/ui/numbers.js',
  '/js/ui/mic-status.js',
  '/static-mode.js',
  '/numbers-repair.js',
  '/js/ui/pitch-trail.js',
  '/js/ui/music-data.js',
  '/js/ui/progress.js',
  '/icon-192.png',
  '/icon-512.png',
  '/icons.svg',
  '/manifest.json',
  '/data/ragas.json',
  '/data/alankars.json',
  '/data/theory.json',
  '/robots.txt'
];
const DATA_URLS = ['/api/ragas', '/api/alankars', '/api/theory'];
const PRIVATE_API_URLS = ['/api/stats', '/api/recordings', '/api/users', '/api/me', '/api/upload'];

self.addEventListener('install', (event) => {
  const install = caches.open(CACHE_VERSION).then((c) => c.addAll(APP_SHELL));
  if (!self.__gansiRefreshArmed) {
    self.__gansiRefreshArmed = true;
    event.waitUntil((async () => {
      const controlled = await self.clients.matchAll({ type: 'window' });
      if (!controlled.length) return;
      const oldCache = await caches.open(CACHE_VERSION);
      const oldHtml = await oldCache.match('/index.html');
      if (!oldHtml) return;
      const html = await oldHtml.text();
      if (!html.includes('numbers-repair.js')) {
        self.__gansiRefreshRequired = true;
        for (const client of controlled) client.postMessage({ type: 'GANSI_REFRESH_REQUIRED', version: CACHE_VERSION });
      }
    })());
  }

  event.waitUntil(
    install.then(() => self.skipWaiting()).then(() => {
      // If the controlling SW served a cached HTML document that does not
      // include the current JS, navigating can finish before the updated
      // shell cache is ready. Signal open clients to reload into the fresh
      // document once. This repair is not used for normal updates.
      if (!self.__gansiRefreshRequired) return;
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) client.postMessage({ type: 'GANSI_REFRESH', version: CACHE_VERSION });
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Private/personal APIs must always hit the network and never enter Cache Storage.
  if (PRIVATE_API_URLS.some((p) => url.pathname.startsWith(p))) return;
  // Never cache uploads/stream.
  if (url.pathname.includes('/recordings') || url.pathname.includes('/upload')) return;
  if (DATA_URLS.some((p) => url.pathname.startsWith(p))) {
    // stale-while-revalidate for music data
    event.respondWith(
      caches.open(CACHE_VERSION).then((cache) =>
        cache.match(request).then((cached) => {
          const net = fetch(request).then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          }).catch(() => cached);
          return cached || net;
        })
      )
    );
    return;
  }
  // App shell: network-first. This prevents an old cached HTML/JS/CSS bundle
  // from replacing a freshly loaded page a few seconds later.
  event.respondWith(
    fetch(request, { cache: 'no-cache' }).then((res) => {
      if (res.ok && (request.destination === 'document' || request.destination === 'script' || request.destination === 'style' || request.destination === 'image')) {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
      }
      return res;
    }).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.destination === 'document') return caches.match('/index.html');
      return Response.error();
    })
  );
});
