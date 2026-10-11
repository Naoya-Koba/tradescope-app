const CACHE_NAME = 'tradescope-static-v270';
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./history.html",
  "./import.html",
  "./import/pdf-extractor.mjs?v=20261011-2",
  "./import/gmo-parser.js?v=20261011-1",
  "./import/gmo-save.js?v=20261011-1",
  "./import/gmo-preview.js?v=20261011-3",
  "./vendor/pdfjs-6.4.299/pdf.mjs",
  "./vendor/pdfjs-6.4.299/pdf.worker.mjs",
  "./vendor/pdfjs-6.4.299/cmaps/90ms-RKSJ-H.bcmap",
  "./vendor/pdfjs-6.4.299/cmaps/Adobe-Japan1-UCS2.bcmap",
  "./import/csv-core.js?v=20261005-1",
  "./import/sbi-parser.js?v=20261009-2",
  "./import/model-preview.js?v=20261010-1",
  "./import/sbi-save.js?v=20261010-1",
  "./import/preview.js?v=20261010-1",
  "./import/preview.css?v=20261011-2",
  "./manifest.webmanifest",
  "./assets/app-gestures.js",
  "./assets/account-ui.js?v=20261011-1",
  "./assets/storage-transaction.js?v=20261010-3",
  "./assets/data-model-storage.js?v=20261011-4",
  "./assets/trade-history-core.js?v=20261003-1",
  "./top/style.css?v=20261003-2",
  "./top/script.js?v=20261011-4",
  "./history/history.css",
  "./history/history.js?v=20261011-1",
  "./profit/soneki.html",
  "./profit/soneki.css?v=20261011-2",
  "./profit/soneki.js?v=20261011-4",
  "./assets/sbi-input-draft.js?v=20261011-2",
  "./assets/profit-metrics.js?v=20261011-2",
  "./assets/monthly-account-resolver.js?v=20261011-5",
  "./assets/monthly-display-view.js?v=20261011-1",
  "./assets/sbi-monthly-save.js?v=20261011-1",
  "./assets/sbi-monthly-ui.js?v=20261011-2",
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
      fetch(event.request).catch(async () => (await caches.match(event.request, { ignoreSearch: true })) || caches.match("./index.html"))
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
