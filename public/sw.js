const CACHE_NAME = 'nfc-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Simple pass-through for now. For full offline, we could cache dynamic requests.
  event.respondWith(fetch(event.request).catch(() => new Response('App is offline')));
});
