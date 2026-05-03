/**
 * –егистраци€ service-worker
 *
 * SW лежит в "/sw.js" (vite копирует public/ в корень dist)
 */
export async function registerServiceWorker(): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                    installing.postMessage({ type: 'SKIP_WAITING' });
                }
            });
        });
    } catch (err) {
        console.warn('[sw] registration failed:', err);
    }
}

/**
 * ”далить из Cache Storage все HLS-сегменты конкретного трека Ч
 * вызываетс€ приложением при "убрать офлайн"
 */
export function purgeOfflineTrack(trackId: string): void {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.controller?.postMessage({
        type: 'PURGE_HLS_TRACK',
        trackId,
    });
}

/**
 * ќчистить весь HLS-кэш (вызываетс€ из настроек / logout)
 */
export function purgeAllOffline(): void {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.controller?.postMessage({ type: 'PURGE_HLS_ALL' });
}