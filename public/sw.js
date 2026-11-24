/* Gan-si SW v2: app-shell cache-first, music data SWR, never cache POST/stream */
const CACHE_VERSION = 'sur-sadhana-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/themes.css',
  '/css/responsive.css',
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
  '/js/practice/vocal-range.js',
  '/js/practice/alankar-generator.js',
  '/js/practice/analytics.js',
  '/js/practice/ear-training.js',
  '/js/ui/auth.js',
  '/js/ui/progress.js',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json'
];
const DATA_URLS = ['/api/ragas', '/api/alankars'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
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
  if (!url.origin.startsWith(self.location.origin)) return;
  // Never cache uploads/stream or stats POSTs (GET stats: network-first, no put on failure)
  if (url.pathname.includes('/recordings') || url.pathname.includes('/upload')) {
    return;
  }
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
  // App shell: cache-first
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && (request.destination === 'document' || request.destination === 'script' || request.destination === 'style')) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return res;
        })
    )
  );
});
