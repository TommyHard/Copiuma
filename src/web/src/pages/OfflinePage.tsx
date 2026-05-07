import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    listOfflineTracks,
    addOfflineTrack,
    removeOfflineTrack,
    markOfflineDownloaded,
    type OfflineTrackItem,
} from '@/shared/api/offline';
import { getTrack } from '@/shared/api/catalog';
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
import { Tooltip } from '@/shared/ui/Tooltip';
import {
    TrashIcon,
    CheckIcon,
    DownloadIcon,
    PlayIcon,
    InfoIcon,
    MusicIcon,
    RefreshIcon
} from '@/shared/ui/icons';

const scrollbarClasses = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-fg-muted/50";
const scrollableListClasses = cn("max-h-[600px] overflow-y-auto overflow-x-hidden rounded-md border border-border bg-bg/50", scrollbarClasses);

export function OfflinePage() {
    const qc = useQueryClient();
    const { isOffline } = useAuth();
    const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);

    const tracksQ = useQuery({
        queryKey: ['offline-tracks'],
        queryFn: listOfflineTracks,
        retry: false,
        staleTime: isOffline ? Infinity : 30_000,
    });

    const cacheQ = useQuery({
        queryKey: ['offline-cache-stats'],
        queryFn: getCacheStats,
        staleTime: 0,
    });

    const handlePurgeCache = async () => {
        purgeAllOffline();
        if ('caches' in window) await caches.delete('cw-hls-v1');
        qc.invalidateQueries({ queryKey: ['offline-cache-stats'] });
        qc.invalidateQueries({ queryKey: ['offline-tracks'] });
        setIsPurgeModalOpen(false);
    };

    return (
        <div className="relative z-10 space-y-8 p-6">
            <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-accent/20 to-transparent pointer-events-none z-[-1]" />

            <header className="pt-8 flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-bold tracking-tight">Офлайн-режим</h1>
                    <p className="text-sm tracking-tight">
                        Треки, доступные без интернета.
                    </p>
                </div>

                {cacheQ.data && (
                    <div className="flex flex-col items-end gap-2 p-3 rounded-lg border border-border bg-bg-elevated/50 backdrop-blur-sm">
                        <div className="text-md font-medium">
                            {cacheQ.data.tracks} треков • {cacheQ.data.entries} сегментов
                        </div>
                        <button
                            onClick={() => setIsPurgeModalOpen(true)}
                            className="flex items-center gap-2 text-[13px] font-bold tracking-wider text-danger hover:underline"
                        >
                            <TrashIcon className="size-3" />
                            Очистить кэш
                        </button>
                    </div>
                )}
            </header>

            <Section title="Ваша библиотека">
                {tracksQ.isLoading && <p className="tracking-tight animate-pulse">Загрузка списка...</p>}

                {tracksQ.data && tracksQ.data.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-12 text-center">
                        <MusicIcon className="mx-auto size-8 tracking-tight/30 mb-4" />
                        <p className="tracking-tight">Пока ничего не скачано.</p>
                    </div>
                ) : (
                    <div className={scrollableListClasses}>
                        <ul className="divide-y divide-border/50">
                            {tracksQ.data?.map((t) => (
                                <OfflineRow key={t.trackId} item={t} />
                            ))}
                        </ul>
                    </div>
                )}
            </Section>

            {isPurgeModalOpen && createPortal(
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-xl border border-border bg-bg-elevated p-6 shadow-2xl">
                        <h3 className="text-lg font-bold">Очистить весь офлайн?</h3>
                        <p className="mt-2 text-sm tracking-tight">
                            Это действие безвозвратно удалит все скачанные сегменты аудио из памяти браузера.
                        </p>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setIsPurgeModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium hover:underline text-fg"
                            >
                                Отмена
                            </button>
                            <button
                                onClick={handlePurgeCache}
                                className="rounded-full bg-danger px-5 py-2 text-sm font-bold text-white hover:opacity-90"
                            >
                                Удалить всё
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold px-1">{title}</h2>
            {children}
        </div>
    );
}

function OfflineRow({ item }: { item: OfflineTrackItem }) {
    const qc = useQueryClient();
    const play = usePlayTrack();
    const [cached, setCached] = useState<boolean | null>(null);
    const [progress, setProgress] = useState<DownloadProgress | null>(null);
    const [busy, setBusy] = useState(false);

    const trackQ = useQuery({
        queryKey: ['track', item.trackId],
        queryFn: () => getTrack(item.trackId),
        staleTime: 5 * 60 * 1000,
    });

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
        try {
            await downloadTrackHls(item.trackId, setProgress);
            await markOfflineDownloaded(item.trackId);
            setCached(true);
            qc.invalidateQueries({ queryKey: ['offline-tracks'] });
            qc.invalidateQueries({ queryKey: ['offline-cache-stats'] });
        } catch (err) {
            console.error(err);
        } finally {
            setBusy(false);
        }
    }

    async function onRecache() {
        await purgeTrackFromCache(item.trackId);
        setCached(false);
        await onDownload();
    }

    const renderArtists = () => {
        const base = (
            <Link to={`/artists/${item.artistId}`} className="hover:text-fg transition-colors">
                {item.artist ?? 'Артист'}
            </Link>
        );

        const featured = trackQ.data?.featuredArtists;
        if (featured && featured.length > 0) {
            return (
                <div className="flex items-center gap-1">
                    {base}
                    <span className="tracking-tightmuted/50 text-[10px]">feat.</span>
                    {featured.map((fa: any, idx: number) => (
                        <span key={fa.id}>
                            <Link to={`/artists/${fa.id}`} className="hover:text-fg">
                                {fa.name}
                            </Link>
                            {idx < featured.length - 1 && ', '}
                        </span>
                    ))}
                </div>
            );
        }
        return base;
    };

    return (
        <li className="group flex items-center gap-4 px-4 py-3 hover:bg-fg/5 transition-colors">
            <Tooltip content="Играть" position="right">
                <button
                    onClick={() => play({ ...item, id: item.trackId, uploadedAt: '', isExplicit: false, trackNumber: null })}
                    className="flex shrink-0 items-center justify-center p-2 text-fg/80 hover:text-accent transition-colors"
                >
                    <PlayIcon className="size-6" />
                </button>
            </Tooltip>

            <div className="min-w-0 flex-1">
                <Link to={`/tracks/${item.trackId}`} className="block truncate font-bold hover:underline">
                    {item.title}
                </Link>
                <div className="truncate text-xs text-fg-muted font-medium flex gap-1 items-center">
                    {item.artistId ? renderArtists() : <span>{item.artist}</span>}
                    <span>•</span>
                    <span className="capitalize">{item.source.replace('playlist:', 'Плейлист: ')}</span>
                </div>

                {progress && busy && (
                    <div className="mt-2 max-w-xs">
                        <div className="h-1 w-full rounded-full bg-border overflow-hidden">
                            <div
                                className="h-full bg-accent transition-all duration-300"
                                style={{ width: `${(progress.completed / (progress.total || 1)) * 100}%` }}
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-3">
                <Tooltip
                    content={cached ? "Файлы сохранены в кэше" : "Ожидает скачивания"}
                    position="left"
                >
                    <div className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        cached ? "bg-accent/10 text-accent" : "bg-fg/5 text-fg-muted"
                    )}>
                        {cached ? <CheckIcon className="size-3" /> : <InfoIcon className="size-3" />}
                        {cached ? "Готово" : "Ожидает"}
                    </div>
                </Tooltip>

                <div className="flex items-center gap-1">
                    {!cached ? (
                        <Tooltip content="Скачать" position="top">
                            <button
                                onClick={onDownload}
                                disabled={busy}
                                className="p-2 rounded-full hover:bg-bg-elevated text-accent transition-colors disabled:opacity-30"
                            >
                                <DownloadIcon className="size-5" />
                            </button>
                        </Tooltip>
                    ) : (
                        <Tooltip content="Обновить кэш" position="top">
                            <button
                                onClick={onRecache}
                                disabled={busy}
                                className="p-2 rounded-full hover:bg-bg-elevated text-fg-muted hover:text-fg transition-colors"
                            >
                                <RefreshIcon className="size-4" />
                            </button>
                        </Tooltip>
                    )}

                    <Tooltip content="Удалить из офлайн" position="top">
                        <button
                            onClick={() => remove.mutate()}
                            disabled={busy}
                            className="p-2 rounded-full hover:bg-danger/10 text-fg-muted hover:text-danger transition-colors"
                        >
                            <TrashIcon className="size-4" />
                        </button>
                    </Tooltip>
                </div>
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