const CACHE_NAME = 'tmc-cache-v6';
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

// Allow client to force update / cache reset (useful on iOS Safari)
self.addEventListener('message', (event) => {
    const data = event.data || {};

    if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
        return;
    }

    if (data.type === 'CLEAR_CACHES') {
        event.waitUntil((async () => {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
            const cache = await caches.open(CACHE_NAME);
            await cache.addAll(ASSETS);
            await self.clients.claim();

            // reply to caller (MessageChannel)
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({ ok: true, cache: CACHE_NAME });
            }
        })());
    }
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
        const dest = req.destination;
        const isNav = req.mode === 'navigate' || dest === 'document';
        const isCritical = isNav || dest === 'script' || dest === 'style';

        // For critical assets: prefer network (so "Обновить" really updates), fallback to cache
        if (isCritical) {
            event.respondWith((async () => {
                try {
                    const netReq = new Request(req, { cache: 'reload' });
                    const res = await fetch(netReq);
                    const copy = res.clone();
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(req, copy);
                    return res;
                } catch (e) {
                    const cached = await caches.match(req);
                    if (cached) return cached;
                    throw e;
                }
            })());
            return;
        }

        // For остальных ресурсов: cache-first
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
