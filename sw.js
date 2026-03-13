/**
 * CartonCheck — Service Worker
 * Enables offline caching for PWA functionality
 */

const CACHE_NAME = 'cartoncheck-v45';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon.svg',
    '/particles.min.js'
];

// Install — pre-cache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate — clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch — cache-first strategy
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
            .catch(() => {
                // If both cache and network fail, return fallback for HTML
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            })
    );
});
