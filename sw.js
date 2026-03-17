/**
 * Matchbox — Service Worker
 * Ensures latest version is always active by avoiding aggressive caching
 */

const CACHE_NAME = 'matchbox-v2';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icons/icon.svg',
    '/particles.min.js'
];

// Install: Cache new assets and force update
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting()) // Forces the waiting service worker to become active
    );
});

// Activate: Remove old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim()) // Become active immediately for all pages
    );
});

// Fetch Strategy: Network-First (Safer for ensuring latest build reflects)
self.addEventListener('fetch', (event) => {
    // Only intercept local assets or HTML
    const isLocalAsset = ASSETS.some(asset => event.request.url.includes(asset));
    
    if (isLocalAsset || event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Update cache with the fresh network response
                    const resClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
                    return response;
                })
                .catch(() => caches.match(event.request)) // Fallback to cache if offline
        );
    } else {
        // Default strategy for other assets (CDN, etc.)
        event.respondWith(
            caches.match(event.request).then(cached => cached || fetch(event.request))
        );
    }
});
