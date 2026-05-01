import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clearHistory, recentArtists, recentTracks, rawHistory } from '@/shared/api/history';
import { usePlayTrack } from '@/features/player/usePlayTrack';
import { cn } from '@/shared/lib/cn';
import type { RawPlayEvent } from '@/shared/types';

type Tab = 'tracks' | 'artists' | 'raw';

export function HistoryPage() {
    const [tab, setTab] = useState<Tab>('tracks');
    const qc = useQueryClient();
    const play = usePlayTrack();

    const tracks = useQuery({
        queryKey: ['history-tracks'],
        queryFn: () => recentTracks(50),
        enabled: tab === 'tracks',
    });

    const artists = useQuery({
        queryKey: ['history-artists'],
        queryFn: () => recentArtists(30),
        enabled: tab === 'artists',
    });

    const raw = useQuery({
        queryKey: ['history-raw'],
        queryFn: () => rawHistory(200, 90),
        enabled: tab === 'raw',
    });

    const clear = useMutation({
        mutationFn: clearHistory,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['history-tracks'] });
            qc.invalidateQueries({ queryKey: ['history-artists'] });
            qc.invalidateQueries({ queryKey: ['history-raw'] });
        },
    });

    return (
        <section className="space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">История</h1>
                <button
                    onClick={() => {
                        if (confirm('Очистить всю историю?')) clear.mutate();
                    }}
                    disabled={clear.isPending}
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg-elevated disabled:opacity-50"
                >
                    Очистить
                </button>
            </header>

            <div className="flex gap-4 border-b border-border text-sm">
                <TabBtn active={tab === 'tracks'} onClick={() => setTab('tracks')}>
                    Треки
                </TabBtn>
                <TabBtn active={tab === 'artists'} onClick={() => setTab('artists')}>
                    Артисты
                </TabBtn>
                <TabBtn active={tab === 'raw'} onClick={() => setTab('raw')}>
                    Raw
                </TabBtn>
            </div>

            {tab === 'tracks' && (
                <>
                    {tracks.isLoading && <p className="text-fg-muted">Загружаем…</p>}
                    {tracks.data && tracks.data.length === 0 && (
                        <p className="text-fg-muted">Ещё ничего не слушал.</p>
                    )}
                    {tracks.data && tracks.data.length > 0 && (
                        <ul className="divide-y divide-border rounded-md border border-border">
                            {tracks.data.map((t) => (
                                <li key={t.trackId} className="flex items-center gap-3 px-4 py-3">
                                    <button
                                        onClick={() =>
                                            play({
                                                id: t.trackId,
                                                title: t.title,
                                                artist: t.artist,
                                                duration: null,
                                                uploadedAt: '',
                                                artistId: t.artistId,
                                                albumId: null,
                                                trackNumber: null,
                                                isExplicit: false,
                                            })
                                        }
                                        className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-fg hover:opacity-90"
                                        title="Играть">
                                        ▶
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <Link
                                            to={`/tracks/${t.trackId}`}
                                            className="block truncate font-medium hover:underline">
                                            {t.title}
                                        </Link>
                                        <div className="truncate text-xs text-fg-muted">{t.artist ?? '—'}</div>
                                    </div>
                                    <div className="text-right text-xs text-fg-muted">
                                        <div>×{t.playCount}</div>
                                        <div>{relTime(t.lastPlayedAt)}</div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}

            {tab === 'raw' && (
                <>
                    {raw.isLoading && <p className="text-fg-muted">Загружаем…</p>}
                    {raw.data && raw.data.length === 0 && (
                        <p className="text-fg-muted">Нет событий за последние 90 дней.</p>
                    )}
                    {raw.data && raw.data.length > 0 && (
                        <>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => exportJson(raw.data!)}
                                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg-elevated"
                                >
                                    ↓ Экспорт JSON
                                </button>
                            </div>
                            <ul className="divide-y divide-border rounded-md border border-border">
                                {raw.data.map((e, i) => (
                                    <li key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate font-medium">{e.title}</div>
                                            <div className="truncate text-xs text-fg-muted">{e.artist ?? '—'}</div>
                                        </div>
                                        <div className="shrink-0 text-right text-xs text-fg-muted">
                                            <div>{Math.round(e.playedMs / 1000)}с{e.completed ? ' ✓' : ''}</div>
                                            <div>{relTime(e.startedAt)}</div>
                                            {e.source && <div className="italic">{e.source}</div>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </>
            )}

            {tab === 'artists' && (
                <>
                    {artists.isLoading && <p className="text-fg-muted">Загружаем…</p>}
                    {artists.data && artists.data.length === 0 && (
                        <p className="text-fg-muted">Ещё никого не слушал.</p>
                    )}
                    {artists.data && artists.data.length > 0 && (
                        <ul className="divide-y divide-border rounded-md border border-border">
                            {artists.data.map((a) => (
                                <li key={a.artistId} className="flex items-center gap-3 px-4 py-3">
                                    <Link
                                        to={`/artists/${a.artistId}`}
                                        className="min-w-0 flex-1 truncate font-medium hover:underline"
                                    >
                                        {a.name}
                                    </Link>
                                    <div className="text-right text-xs text-fg-muted">
                                        <div>×{a.playCount}</div>
                                        <div>{relTime(a.lastPlayedAt)}</div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </section>
    );
}

function TabBtn({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                '-mb-px border-b-2 px-3 py-2 text-fg-muted hover:text-fg',
                active ? 'border-accent text-fg' : 'border-transparent',
            )}
        >
            {children}
        </button>
    );
}

function exportJson(data: RawPlayEvent[]) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `copiuma-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function relTime(iso: string): string {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'только что';
    if (min < 60) return `${min}м назад`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}ч назад`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}д назад`;
    return d.toLocaleDateString('ru');
}