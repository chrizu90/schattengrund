/* Offline-Cache für Schattengrund. Bei Änderungen VERSION erhöhen. */
const VERSION = "schattengrund-v1";
const FILES = [
  "./", "./index.html", "./logic.js", "./ui.js", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png",
  "./fonts/cinzel-latin-700-normal.woff2", "./fonts/ibm-plex-mono-latin-400-normal.woff2", "./fonts/ibm-plex-mono-latin-700-normal.woff2"
];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
