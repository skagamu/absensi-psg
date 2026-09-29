const CACHE_NAME = 'presensi-psg-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json',
  '/icon.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/@phosphor-icons/web'
];

self.addEventListener('install', (e) => {
  console.log('[Service Worker] Install');
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Hanya cache GET. Google Apps Script POST di bypass.
  if (e.request.method !== 'GET') return;
  
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request).then((networkResponse) => {
        // Dinamis cache untuk request lokal & CDN
        if (e.request.url.startsWith(self.location.origin) || e.request.url.includes('cdn') || e.request.url.includes('unpkg')) {
           const cacheData = networkResponse.clone();
           caches.open(CACHE_NAME).then((cache) => cache.put(e.request, cacheData));
        }
        return networkResponse;
      });
    }).catch(() => {
        // Fallback offline murni
        return caches.match('/index.html');
    })
  );
});
