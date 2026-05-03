/**
 * Кэши:
 *   cw-shell-v1 — index.html + статические ассеты приложения. Покрывает запуск
 *                 PWA в офлайне.
 *   cw-hls-v1   — HLS-плейлисты (.m3u8) и сегменты (.ts). Заполняется
 *                 приложением при добавлении трека в офлайн (см. offlineCache.ts)
 *
 * Стратегии:
 *   /hls/        — cache-only с прозрачным fallback в сеть
 *                  Если у трека что-то лежит в кэше — отдаём кэш и не лезем в сеть
 *                  Иначе — обычный сетевой fetch (тогда слушаем онлайн)
 *   navigation   — network-first с fallback на cached '/'
 *   static       — cache-first с фоновым обновлением
 */

const SHELL_CACHE = 'cw-shell-v1';
const HLS_CACHE = 'cw-hls-v1';
const SHELL_PRECACHE = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then((cache) =>
            cache.addAll(SHELL_PRECACHE).catch(() => {/* ignore */ }),
        ),
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((k) => k !== SHELL_CACHE && k !== HLS_CACHE)
                    .map((k) => caches.delete(k)),
            );
            await self.clients.claim();
        })(),
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    let url;
    try { url = new URL(req.url); } catch { return; }

    if (url.origin !== self.location.origin) return;

    if (url.pathname.includes('/hls/')) {
        event.respondWith(handleHls(req));
        return;
    }

    if (url.pathname.startsWith('/api/notifications-hub') || url.pathname.startsWith('/api/follows/')) {
        return;
    }

    if (req.mode === 'navigate') {
        event.respondWith(handleNavigation(req));
        return;
    }

    if (
        url.pathname.startsWith('/assets/') ||
        url.pathname === '/favicon.svg' ||
        url.pathname === '/manifest.webmanifest' ||
        /\.(?:js|css|svg|png|webp|woff2?)$/.test(url.pathname)
    ) {
        event.respondWith(handleStatic(req));
        return;
    }
});

async function handleHls(req) {
    const cache = await caches.open(HLS_CACHE);
    const cached = await cache.match(req, { ignoreVary: true, ignoreSearch: false });
    if (cached) return cached;

    try {
        const fresh = await fetch(req);
        return fresh;
    } catch (err) {
        return new Response('Offline: segment not cached', {
            status: 504,
            statusText: 'Offline',
            headers: { 'Content-Type': 'text/plain' },
        });
    }
}

async function handleNavigation(req) {
    try {
        const fresh = await fetch(req);
        if (fresh.ok) {
            const cache = await caches.open(SHELL_CACHE);
            cache.put('/index.html', fresh.clone());
        }
        return fresh;
    } catch (err) {
        const cache = await caches.open(SHELL_CACHE);
        const cached = (await cache.match('/index.html')) || (await cache.match('/'));
        if (cached) return cached;
        return new Response('<h1>Offline</h1><p>Нет подключения и нет кэша.</p>', {
            status: 504, headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
    }
}

async function handleStatic(req) {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(req);
    if (cached) {
        fetch(req)
            .then((fresh) => { if (fresh && fresh.ok) cache.put(req, fresh); })
            .catch(() => { });
        return cached;
    }
    try {
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
    } catch (err) {
        return new Response('', { status: 504, statusText: 'Offline' });
    }
}

self.addEventListener('message', (event) => {
    const data = event.data || {};
    if (data.type === 'PURGE_HLS_TRACK' && data.trackId) {
        event.waitUntil(purgeHlsTrack(data.trackId));
    } else if (data.type === 'PURGE_HLS_ALL') {
        event.waitUntil(caches.delete(HLS_CACHE));
    } else if (data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

async function purgeHlsTrack(trackId) {
    const cache = await caches.open(HLS_CACHE);
    const keys = await cache.keys();
    const target = `/tracks/${trackId}/hls/`;
    await Promise.all(
        keys
            .filter((req) => req.url.includes(target))
            .map((req) => cache.delete(req)),
    );
}
