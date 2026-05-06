import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    listOfflineTracks,
    addOfflineTrack,
    removeOfflineTrack,
    markOfflineDownloaded,
    type OfflineTrackItem,
} from '@/shared/api/offline';
import {
    downloadTrackHls,
    getCacheStats,
    isTrackCachedOffline,
    purgeTrackFromCache,
    type DownloadProgress,
} from '@/features/offline/offlineCache';
import { purgeAllOffline } from '@/shared/lib/serviceWorker';
import { usePlayTrack } from '@/features/player/usePlayTrack';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/shared/lib/cn';

const OFFLINE_LIST_KEY = 'cw:offline-list';

function readCachedList(): OfflineTrackItem[] | null {
    try {
        const raw = localStorage.getItem(OFFLINE_LIST_KEY);
        return raw ? (JSON.parse(raw) as OfflineTrackItem[]) : null;
    } catch {
        return null;
    }
}

function writeCachedList(list: OfflineTrackItem[]): void {
    try {
        localStorage.setItem(OFFLINE_LIST_KEY, JSON.stringify(list));
    } catch { /* ignore */ }
}

async function listOrCached(): Promise<OfflineTrackItem[]> {
    try {
        const fresh = await listOfflineTracks();
        writeCachedList(fresh);
        return fresh;
    } catch (err) {
        const cached = readCachedList();
        if (cached) return cached;
        throw err;
    }
}

/**
 * Список "офлайн" треков. Метаданные приходят с сервера (OfflineController),
 * сами HLS-сегменты лежат в Cache Storage и проигрываются через service worker
 */
export function OfflinePage() {
    const qc = useQueryClient();
    const { isOffline } = useAuth();

    const tracksQ = useQuery({
        queryKey: ['offline-tracks'],
        queryFn: listOrCached,
        retry: false,
        staleTime: isOffline ? Infinity : 30_000,
    });

    const cacheQ = useQuery({
        queryKey: ['offline-cache-stats'],
        queryFn: getCacheStats,
        staleTime: 0,
        refetchOnWindowFocus: true,
    });

    return (
        <section className="space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-semibold">Офлайн</h1>
                    <p className="mt-1 text-sm text-fg-muted">
                        Треки, отмеченные для прослушивания без сети. Сегменты лежат
                        в браузере и работают благодаря service worker.
                    </p>
                </div>
                {cacheQ.data && (
                    <div className="text-right text-xs text-fg-muted">
                        Кэш: {cacheQ.data.tracks} треков •{' '}
                        {cacheQ.data.entries} файлов
                        <button
                            onClick={async () => {
                                if (!confirm('Очистить весь офлайн-кэш аудио?')) return;
                                purgeAllOffline();
                                if ('caches' in window) await caches.delete('cw-hls-v1');
                                qc.invalidateQueries({ queryKey: ['offline-cache-stats'] });
                                qc.invalidateQueries({ queryKey: ['offline-tracks'] });
                            }}
                            className="ml-2 rounded border border-border px-2 py-0.5 text-fg-muted hover:bg-bg-elevated"
                        >
                            Очистить кэш
                        </button>
                    </div>
                )}
            </header>

            {tracksQ.isLoading && <p className="text-fg-muted">Загружаем…</p>}
            {tracksQ.isError && <p className="text-danger">Не удалось получить список.</p>}

            {tracksQ.data && tracksQ.data.length === 0 && (
                <div className="rounded-md border border-border bg-bg-elevated p-6 text-fg-muted">
                    Пока ничего не отмечено офлайн. Зайдите на страницу любого трека и
                    нажмите "Скачать офлайн".
                </div>
            )}

            {tracksQ.data && tracksQ.data.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                    {tracksQ.data.map((t) => (
                        <OfflineRow key={t.trackId} item={t} />
                    ))}
                </ul>
            )}
        </section>
    );
}

function OfflineRow({ item }: { item: OfflineTrackItem }) {
    const qc = useQueryClient();
    const play = usePlayTrack();

    const [cached, setCached] = useState<boolean | null>(null);
    const [progress, setProgress] = useState<DownloadProgress | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void isTrackCachedOffline(item.trackId).then((v) => {
            if (!cancelled) setCached(v);
        });
        return () => { cancelled = true; };
    }, [item.trackId]);

    const remove = useMutation({
        mutationFn: () => removeOfflineTrack(item.trackId),
        onSuccess: async () => {
            await purgeTrackFromCache(item.trackId);
            qc.invalidateQueries({ queryKey: ['offline-tracks'] });
            qc.invalidateQueries({ queryKey: ['offline-cache-stats'] });
        },
    });

    async function onDownload() {
        setBusy(true);
        setError(null);
        setProgress({ total: 0, completed: 0, failed: 0 });
        try {
            await downloadTrackHls(item.trackId, setProgress);
            await markOfflineDownloaded(item.trackId);
            setCached(true);
            qc.invalidateQueries({ queryKey: ['offline-tracks'] });
            qc.invalidateQueries({ queryKey: ['offline-cache-stats'] });
        } catch (err: any) {
            setError(err?.message ?? 'Не удалось скачать');
            const fresh = await isTrackCachedOffline(item.trackId).catch(() => false);
            setCached(fresh);
            qc.invalidateQueries({ queryKey: ['offline-cache-stats'] });
        } finally {
            setBusy(false);
        }
    }

    async function onRecache() {
        await purgeTrackFromCache(item.trackId);
        setCached(false);
        await onDownload();
    }

    return (
        <li className="flex flex-wrap items-center gap-3 px-4 py-3">
            <button
                onClick={() => play({
                    id: item.trackId,
                    title: item.title,
                    artist: item.artist,
                    duration: item.duration,
                    artistId: item.artistId,
                    albumId: item.albumId,
                    trackNumber: null,
                    uploadedAt: '',
                    isExplicit: false,
                })}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg hover:opacity-90"
                title="Играть"
            >
                ▶
            </button>

            <div className="min-w-0 flex-1">
                <Link to={`/tracks/${item.trackId}`} className="block truncate font-medium hover:underline">
                    {item.title}
                </Link>
                <div className="truncate text-xs text-fg-muted">
                    {item.artistId ? (
                        <Link to={`/artists/${item.artistId}`} className="hover:underline">
                            {item.artist ?? 'Неизвестный исполнитель'}
                        </Link>
                    ) : (
                        item.artist ?? 'Неизвестный исполнитель'
                    )}
                    {' • '}
                    {item.source === 'single'
                        ? 'single'
                        : item.source.startsWith('playlist:')
                            ? 'из плейлиста'
                            : item.source.startsWith('album:')
                                ? 'из альбома'
                                : item.source}
                </div>
                {progress && busy && (
                    <div className="mt-1.5">
                        <div className="h-1.5 w-full overflow-hidden rounded bg-bg-elevated">
                            <div
                                className="h-full bg-accent transition-[width]"
                                style={{
                                    width: progress.total > 0
                                        ? `${Math.round((progress.completed / progress.total) * 100)}%`
                                        : '0%',
                                }}
                            />
                        </div>
                        <p className="mt-1 text-[11px] text-fg-muted">
                            Скачано {progress.completed}/{progress.total} сегментов
                            {progress.failed > 0 && ` • ошибок: ${progress.failed}`}
                        </p>
                    </div>
                )}
                {error && <p className="mt-1 text-xs text-danger">{error}</p>}
            </div>

            <div className="flex items-center gap-2 text-xs">
                <span
                    className={cn(
                        'rounded-full px-2 py-0.5',
                        cached === true && 'bg-accent/20 text-accent',
                        cached === false && 'bg-fg/10 text-fg-muted',
                        cached === null && 'bg-fg/10 text-fg-muted',
                    )}
                    title={cached === true
                        ? 'Аудио лежит в Cache Storage'
                        : 'Сегменты не скачаны — будет проигрываться из сети'}
                >
                    {cached === true ? '✓ в кэше' : cached === false ? 'не в кэше' : '…'}
                </span>

                {cached !== true && (
                    <button
                        onClick={onDownload}
                        disabled={busy}
                        className="rounded-md bg-accent px-3 py-1.5 text-accent-fg hover:opacity-90 disabled:opacity-50"
                    >
                        {busy ? 'Качаем…' : 'Скачать'}
                    </button>
                )}
                {cached === true && (
                    <button
                        onClick={onRecache}
                        disabled={busy}
                        className="rounded-md border border-border px-3 py-1.5 hover:bg-bg-elevated disabled:opacity-50"
                        title="Перекачать сегменты заново"
                    >
                        {busy ? 'Качаем…' : 'Обновить'}
                    </button>
                )}
                <button
                    onClick={() => remove.mutate()}
                    disabled={remove.isPending || busy}
                    className="rounded-md border border-danger/40 px-3 py-1.5 text-danger hover:bg-danger/10 disabled:opacity-50"
                >
                    Убрать
                </button>
            </div>
        </li>
    );
}

export function useToggleOfflineForTrack(trackId: string) {
    const qc = useQueryClient();
    const [cached, setCached] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);
    const [progress, setProgress] = useState<DownloadProgress | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!trackId) {
            setCached(null);
            return;
        }
        let cancelled = false;
        void isTrackCachedOffline(trackId).then((v) => {
            if (!cancelled) setCached(v);
        });
        return () => { cancelled = true; };
    }, [trackId]);

    async function add() {
        if (!trackId) return;
        setBusy(true);
        setError(null);
        try {
            await addOfflineTrack(trackId);
            setProgress({ total: 0, completed: 0, failed: 0 });
            await downloadTrackHls(trackId, setProgress);
            await markOfflineDownloaded(trackId);
            setCached(true);
            qc.invalidateQueries({ queryKey: ['offline-tracks'] });
            qc.invalidateQueries({ queryKey: ['offline-cache-stats'] });
        } catch (err: any) {
            setError(err?.message ?? 'Не удалось добавить в офлайн');
            const fresh = await isTrackCachedOffline(trackId).catch(() => false);
            setCached(fresh);
            qc.invalidateQueries({ queryKey: ['offline-cache-stats'] });
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        if (!trackId) return;
        setBusy(true);
        setError(null);
        try {
            await removeOfflineTrack(trackId);
            await purgeTrackFromCache(trackId);
            setCached(false);
            qc.invalidateQueries({ queryKey: ['offline-tracks'] });
            qc.invalidateQueries({ queryKey: ['offline-cache-stats'] });
        } catch (err: any) {
            setError(err?.message ?? 'Не удалось убрать из офлайн');
        } finally {
            setBusy(false);
        }
    }

    return { cached, busy, progress, error, add, remove };
}