// DEVELOPMENT MODE — no caching.
// On first load this SW replaces the old one, clears all caches, and unregisters itself.
// After one reload the app fetches everything live from the server.
//
// To restore offline/caching support: copy sw.production.js back over this file.

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(() => self.registration.unregister())
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then((clients) => clients.forEach((c) => c.navigate(c.url)))
    );
});
