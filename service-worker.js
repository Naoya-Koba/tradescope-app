const CACHE_NAME = 'tradescope-static-v314';
const CORE_ASSETS = [
  "./assets/monthly-required-policy.js?v=20261014-8",
  "./assets/monthly-progress-view.js?v=20261014-11",
  "./assets/sbi-period-input.js?v=20261014-9",
  "./assets/lightfx-scalar-adoption.js?v=20261014-11",
  "./assets/sbi-balance-adoption.js?v=20261014-7",
  "./assets/scalar-source-selection.js?v=20261014-7",
  "./assets/scalar-source-ui.js?v=20261014-7",
  "./assets/sbivc-source-selection.js?v=20261014-6",
  "./assets/sbivc-source-ui.js?v=20261014-6",
  "./assets/sbivc-balance-adoption.js?v=20261015-3",
  "./assets/monthly-source-contract.js?v=20261014-11",
  "./assets/monthly-source-service.js?v=20261014-10",
  "./assets/display-results.js?v=20261014-1",
  "./assets/display-read-state.js?v=20261014-1",
  "./assets/open-positions-view.js?v=20261014-5",
  "./assets/balance-view.js?v=20261013-7",
  "./assets/current-asset-view.js?v=20261014-5",
  "./assets/transaction-reconciliation.js?v=20261013-1",
  "./import/transaction-confirmation.js?v=20261013-1",
  "./",
  "./index.html",
  "./history.html",
  "./import.html",
  "./import/pdf-extractor.mjs?v=20261012-10",
  "./import/pdf-viewer.mjs?v=20261012-10",
  "./import/pdf-viewer-ui.js?v=20261012-11",
  "./import/sbivc-transactions-parser.js?v=20261012-16",
  "./import/sbivc-parser.js?v=20261012-16",
  "./import/sbivc-preview.js?v=20261015-3",
  "./import/sbivc-save.js?v=20261015-3",
  "./assets/observation-adoption.js?v=20261012-15",
  "./assets/observation-override-save.js?v=20261014-5",
  "./assets/observation-input-ui.js?v=20261014-6",
  "./import/pdf-viewer.css?v=20261012-10",
  "./import/traders-parser.js?v=20261014-12",
  "./import/traders-save.js?v=20261014-11",
  "./import/traders-preview.js?v=20261014-11",
  "./assets/traders-monthly-ui.js?v=20261014-11",
  "./import/gmo-transactions-parser.js?v=20261012-6",
  "./import/gmo-parser.js?v=20261012-4",
  "./import/gmo-save.js?v=20261013-1",
  "./import/gmo-preview.js?v=20261013-1",
  "./vendor/pdfjs-6.4.299/pdf.mjs",
  "./vendor/pdfjs-6.4.299/pdf.worker.mjs",
  "./vendor/pdfjs-6.4.299/cmaps/90ms-RKSJ-H.bcmap",
  "./vendor/pdfjs-6.4.299/cmaps/Adobe-Japan1-UCS2.bcmap",
  "./vendor/pdfjs-6.4.299/cmaps/UniJIS-UCS2-H.bcmap",
  "./import/csv-core.js?v=20261005-1",
  "./import/sbi-parser.js?v=20261009-2",
  "./import/model-preview.js?v=20261014-2",
  "./import/sbi-save.js?v=20261014-7",
  "./import/preview.js?v=20261014-7",
  "./import/preview.css?v=20261013-1",
  "./manifest.webmanifest",
  "./assets/app-gestures.js",
  "./assets/account-ui.js?v=20261011-1",
  "./assets/storage-transaction.js?v=20261015-1",
  "./assets/transaction-source-contract.js?v=20261015-1",
  "./assets/transaction-adoption-view.js?v=20261015-2",
  "./assets/data-model-storage.js?v=20261015-3",
  "./assets/transaction-view.js?v=20261015-2",
  "./assets/transaction-display.js?v=20261015-2",
  "./assets/trade-history-core.js?v=20261003-1",
  "./top/style.css?v=20261013-4",
  "./top/script.js?v=20261015-1",
  "./history/history.css?v=20261013-2",
  "./history/history.js?v=20261015-2",
  "./history/transaction-ui.js?v=20261015-2",
  "./profit/soneki.html",
  "./profit/soneki.css?v=20261014-7",
  "./profit/soneki.js?v=20261015-3",
  "./assets/sbi-input-draft.js?v=20261014-7",
  "./assets/profit-metrics.js?v=20261011-3",
  "./assets/monthly-account-resolver.js?v=20261014-11",
  "./assets/monthly-display-view.js?v=20261015-3",
  "./assets/sbi-monthly-save.js?v=20261014-7",
  "./assets/gmo-monthly-save.js?v=20261011-1",
  "./assets/legacy-monthly-save.js?v=20261012-1",
  "./assets/gmo-monthly-ui.js?v=20261014-1",
  "./assets/monthly-input-ui.js?v=20261011-1",
  "./assets/sbi-monthly-ui.js?v=20261014-7",
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
