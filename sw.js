const CACHE_NAME = 'drum-editor-v5';

// All assets pre-cached on install so the app works fully offline.
// Update CACHE_NAME above whenever you deploy new code to push fresh assets to users.
const PRECACHE_URLS = [
    '/',
    'index.html',
    'css/styles.css',
    'js/utils.js',
    'js/notationRenderer.js',
    'js/patternEditor.js',
    'js/grooveEditor.js',
    'js/app.js',
    'lib/abc2svg/abc2svg-1.js',
    'lib/abc2svg/perc-1.js',
    'lib/midi.js/lib/midi.min.js',
    'lib/jsmidgen/lib/jsmidgen.js',
    'manifest.json',
    'icons/icon-192.png',
    'icons/icon-512.png',
    // Audio samples
    'samples/rock-kit/Rock-Kit-Crash-1-1.wav',
    'samples/rock-kit/Rock-Kit-HiHat-Tip-1.wav',
    'samples/rock-kit/Rock-Kit-HiHat-Open.wav',
    'samples/rock-kit/Rock-Kit-HiHat-Pedal.wav',
    'samples/rock-kit/Rock-Kit-Kick-ff-1.wav',
    'samples/rock-kit/Rock-Kit-Floor-1.wav',
    'samples/rock-kit/Rock-Rack-1.wav',
    'samples/rock-kit/Rock-Rack-2.wav',
    'samples/rock-kit/Rock-Snare-ff-2.wav',
    'samples/Piccolo%20Cross%20Stick.wav',
];

// Install: pre-cache everything
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

// Activate: delete any caches from older versions
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((names) => Promise.all(
                names
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch: cache-first strategy.
// Query strings (?v=...) are stripped from cache keys so versioned script URLs
// hit the same cached entry as the base path.
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    // Only handle same-origin requests
    if (url.origin !== self.location.origin) return;

    // Cache key without query string
    const cacheKey = url.origin + url.pathname;

    event.respondWith(
        caches.match(cacheKey).then((cached) => {
            if (cached) return cached;

            // Not in cache yet — fetch, cache, and return
            return fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, clone));
                }
                return response;
            });
        })
    );
});
