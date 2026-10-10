const CACHE_NAME = 'tradescope-static-v258';
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./history.html",
  "./import.html",
  "./import/csv-core.js?v=20261005-1",
  "./import/sbi-parser.js?v=20261009-2",
  "./import/model-preview.js?v=20261010-1",
  "./import/sbi-save.js?v=20261010-1",
  "./import/preview.js?v=20261010-1",
  "./import/preview.css?v=20261010-2",
  "./manifest.webmanifest",
  "./assets/app-gestures.js",
  "./assets/storage-transaction.js?v=20261010-3",
  "./assets/data-model-storage.js?v=20261010-3",
  "./assets/trade-history-core.js?v=20261003-1",
  "./top/style.css?v=20261003-2",
  "./top/script.js?v=20261010-3",
  "./history/history.css",
  "./history/history.js?v=20261003-1",
  "./profit/soneki.html",
  "./profit/soneki.css?v=20261010-1",
  "./profit/soneki.js?v=20261005-1",
  "./assets/profit-metrics.js?v=20261005-2",
  "./assets/bottom-nav.css",
  "./assets/transitions.css",
  "./assets/transitions.js",
  "./assets/icon-192.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
        return response;
      });
    })
  );
});
