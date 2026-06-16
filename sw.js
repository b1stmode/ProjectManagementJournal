const VERSION = 'v1';

self.addEventListener('install', (event) => {
  console.log(`[SW] Install — ${VERSION}`);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[SW] Activate — ${VERSION}`);
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // No caching strategy in M1 — full offline support comes in M6
  event.respondWith(fetch(event.request));
});
