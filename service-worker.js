const CACHE_NAME = "tradescope-cache-v1";
const FILES_TO_CACHE = [
  "index.html",
  "style.css",
  "script.js",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "background.jpg"
];

// インストール時にキャッシュ
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

// 起動後にリクエストをキャッシュから返す
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
