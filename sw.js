self.addEventListener('install', (e) => {
    console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (e) => {
    // Melewati semua fetch request (Minimal untuk bypass syarat PWA)
});
