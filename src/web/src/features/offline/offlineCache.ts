import { tokenStore } from '@/shared/lib/tokenStore';
import { hlsMasterUrl } from '@/shared/api/catalog';

/**
 * Скачивание HLS-плейлистов и сегментов в Cache Storage для офлайн-проигрывания
 *
 * Service worker видит cache "cw-hls-v1" и в "handleHls" отдаёт оттуда
 * запросы по тем же URL, что хранятся здесь. Hls.js при воспроизведении
 * получает данные из кэша — без знания об офлайн-режиме
 */

const HLS_CACHE = 'cw-hls-v1';
const STATUS_KEY = 'cw:offline-status';

interface OfflineStatusEntry {
    complete: boolean;
    segmentCount: number;
    downloadedAt: string;
}

type OfflineStatusMap = Record<string, OfflineStatusEntry>;

export interface DownloadProgress {
    total: number;
    completed: number;
    failed: number;
}

interface VariantInfo {
    bandwidth: number;
    url: string;
}

// public API

export async function isTrackCachedOffline(trackId: string): Promise<boolean> {
    // Учитываем только успешно завершённые загрузки.
    const status = readStatus()[trackId];
    if (!status?.complete) return false;
    if (!('caches' in window)) return false;
    try {
        const cache = await caches.open(HLS_CACHE);
        const master = await cache.match(hlsMasterUrlAbs(trackId));
        return !!master;
    } catch {
        return false;
    }
}

/**
 * Закачивает master + best-quality variant + все сегменты в Cache Storage
 * Если что-то падает — оставляем уже сохранённое; пользователь может попробовать
 * снова, и повторные сегменты будут просто перезаписаны
 */
export async function downloadTrackHls(
    trackId: string,
    onProgress?: (p: DownloadProgress) => void,
): Promise<void> {
    if (!('caches' in window)) {
        throw new Error('Cache Storage недоступен в этом браузере.');
    }

    // Снимаем прошлый "complete" — пока перекачка не завершилась, статус "не скачано"
    setStatusEntry(trackId, null);

    const cache = await caches.open(HLS_CACHE);
    const masterUrl = hlsMasterUrlAbs(trackId);

    const masterText = await fetchAndCacheText(cache, masterUrl);
    const variants = parseMasterPlaylist(masterText, masterUrl);
    if (variants.length === 0) {
        await cache.delete(masterUrl).catch(() => undefined);
        throw new Error('Master playlist пуст или невалиден.');
    }

    const best = variants.reduce((a, b) => (a.bandwidth >= b.bandwidth ? a : b));

    const variantText = await fetchAndCacheText(cache, best.url);
    const segments = parseVariantPlaylist(variantText, best.url);

    if (segments.length === 0) {
        await purgeTrackFromCache(trackId);
        throw new Error('Variant playlist не содержит сегментов.');
    }

    let completed = 0;
    let failed = 0;
    onProgress?.({ total: segments.length, completed, failed });

    const concurrency = 4;
    let cursor = 0;

    async function worker() {
        while (cursor < segments.length) {
            const i = cursor++;
            const url = segments[i];
            try {
                const resp = await authedFetch(url);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                await cache.put(new Request(url), resp.clone());
            } catch (err) {
                failed++;
                console.warn('[offline] segment failed', url, err);
            } finally {
                completed++;
                onProgress?.({ total: segments.length, completed, failed });
            }
        }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    if (failed > 0) {
        await purgeTrackFromCache(trackId);
        throw new Error(
            failed === segments.length
                ? 'Не удалось скачать ни одного сегмента.'
                : `Не удалось скачать ${failed} из ${segments.length} сегментов.`,
        );
    }

    setStatusEntry(trackId, {
        complete: true,
        segmentCount: segments.length,
        downloadedAt: new Date().toISOString(),
    });
}

/**
 * Удаляет master, варианты и все сегменты трека из Cache Storage
 * + сбрасывает статус "complete" в localStorage
 */
export async function purgeTrackFromCache(trackId: string): Promise<void> {
    setStatusEntry(trackId, null);
    if (!('caches' in window)) return;
    try {
        const cache = await caches.open(HLS_CACHE);
        const keys = await cache.keys();
        const target = `/tracks/${trackId}/hls/`;
        await Promise.all(
            keys.filter((req) => req.url.includes(target)).map((req) => cache.delete(req)),
        );
    } catch (err) {
        console.warn('[offline] purge failed', err);
    }
}

export async function getCacheStats(): Promise<{ tracks: number; entries: number }> {
    if (!('caches' in window)) return { tracks: 0, entries: 0 };
    try {
        const cache = await caches.open(HLS_CACHE);
        const keys = await cache.keys();
        const trackIds = new Set<string>();
        for (const req of keys) {
            const m = req.url.match(/\/tracks\/([0-9a-f-]+)\/hls\//i);
            if (m) trackIds.add(m[1]);
        }
        return { tracks: trackIds.size, entries: keys.length };
    } catch {
        return { tracks: 0, entries: 0 };
    }
}

// helpers

/**
 * "hlsMasterUrl" возвращает относительный путь (в дев-окружении "/api/...")
 * Для парсинга и для cache.match нужны абсолютные URL — иначе "new URL(rel, base)"
 * падает, потому что "base" должен быть абсолютным
 */
function hlsMasterUrlAbs(trackId: string): string {
    return new URL(hlsMasterUrl(trackId), window.location.href).toString();
}

async function authedFetch(url: string): Promise<Response> {
    const token = tokenStore.getAccess();
    const headers: HeadersInit = {};
    if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    return fetch(url, { headers, credentials: 'same-origin' });
}

async function fetchAndCacheText(cache: Cache, url: string): Promise<string> {
    const resp = await authedFetch(url);
    if (!resp.ok) throw new Error(`Не удалось скачать ${url}: HTTP ${resp.status}`);
    const text = await resp.text();
    const cached = new Response(text, {
        status: resp.status,
        statusText: resp.statusText,
        headers: resp.headers,
    });
    await cache.put(new Request(url), cached);
    return text;
}

function parseMasterPlaylist(text: string, baseUrl: string): VariantInfo[] {
    const lines = text.split(/\r?\n/);
    const out: VariantInfo[] = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.startsWith('#EXT-X-STREAM-INF:')) continue;
        const bw = /BANDWIDTH=(\d+)/.exec(line);
        const bandwidth = bw ? parseInt(bw[1], 10) : 0;
        for (let j = i + 1; j < lines.length; j++) {
            const next = lines[j].trim();
            if (!next) continue;
            if (next.startsWith('#')) continue;
            const abs = resolveUrl(next, baseUrl);
            if (abs) out.push({ bandwidth, url: abs });
            break;
        }
    }
    return out;
}

function parseVariantPlaylist(text: string, baseUrl: string): string[] {
    const out: string[] = [];
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const abs = resolveUrl(line, baseUrl);
        if (abs) out.push(abs);
    }
    return out;
}

function resolveUrl(ref: string, base: string): string | null {
    try {
        const absBase = /^[a-z]+:\/\//i.test(base)
            ? base
            : new URL(base, window.location.href).toString();
        return new URL(ref, absBase).toString();
    } catch {
        return null;
    }
}

// localStorage status

function readStatus(): OfflineStatusMap {
    try {
        const raw = localStorage.getItem(STATUS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
}

function writeStatus(map: OfflineStatusMap): void {
    try {
        localStorage.setItem(STATUS_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
}

function setStatusEntry(trackId: string, entry: OfflineStatusEntry | null): void {
    const map = readStatus();
    if (entry) {
        map[trackId] = entry;
    } else {
        delete map[trackId];
    }
    writeStatus(map);
}

/** Список trackId, которые реально лежат в локальном кэше */
export function listLocallyCachedTrackIds(): string[] {
    const map = readStatus();
    return Object.entries(map)
        .filter(([, v]) => v.complete)
        .map(([k]) => k);
}

/** local метаданные трека для офлайна */
export interface OfflineTrackMeta {
    title: string;
    artist: string | null;
    artistId: string | null;
    duration: string | null;
    coverUrl: string | null;
    addedAt: string;
}
const META_KEY = 'cw:offline-meta';

function readMetaMap(): Record<string, OfflineTrackMeta> {
    try {
        const raw = localStorage.getItem(META_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
        return {};
    }
}

export function rememberOfflineTrackMeta(trackId: string, meta: OfflineTrackMeta): void {
    try {
        const map = readMetaMap();
        map[trackId] = meta;
        localStorage.setItem(META_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
}

export function forgetOfflineTrackMeta(trackId: string): void {
    try {
        const map = readMetaMap();
        delete map[trackId];
        localStorage.setItem(META_KEY, JSON.stringify(map));
    } catch { /* ignore */ }
}

export function getOfflineTrackMeta(trackId: string): OfflineTrackMeta | null {
    return readMetaMap()[trackId] ?? null;
}

export function listOfflineTrackMeta(): Array<{ trackId: string; meta: OfflineTrackMeta }> {
    const map = readMetaMap();
    return Object.entries(map).map(([trackId, meta]) => ({ trackId, meta }));
}