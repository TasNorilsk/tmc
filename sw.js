const CACHE_NAME = 'tmc-cache-v5';
const ASSETS = [
    './',
    './index.php',
    './style.css',
    './script.js',
    './manifest.json',
    './logos/noname.png',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-192-maskable.png',
    './icons/icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    if (req.method !== 'GET') {
        event.respondWith(
            fetch(req).catch(() =>
                new Response(JSON.stringify({ error: 'offline' }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json; charset=utf-8' }
                })
            )
        );
        return;
    }

    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(req).then((cached) => {
                if (cached) return cached;
                return fetch(req).then((res) => {
                    const copy = res.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
                    return res;
                }).catch(() => cached);
            })
        );
        return;
    }

    event.respondWith(fetch(req));
});
