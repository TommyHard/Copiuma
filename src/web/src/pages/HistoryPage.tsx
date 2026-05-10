import { useState } from 'react';
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { clearHistory, recentArtists, recentTracks, rawHistory } from '@/shared/api/history';
import type { RawPlayEvent } from '@/shared/types';
import { TrackRow } from './track-row';
import { ChevronDownIcon, TrashIcon } from '@/shared/ui/icons';
import { ArtistSlider } from '@/shared/ui/ArtistSlider';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';

const PAGE_SIZE = 20;

export function HistoryPage() {
    const qc = useQueryClient();
    const [isConfirmOpen, setConfirmOpen] = useState(false);

    const artists = useQuery({
        queryKey: ['history-artists'],
        queryFn: () => recentArtists(30),
    });

    const tracksQ = useInfiniteQuery({
        queryKey: ['history-tracks-infinite'],
        queryFn: ({ pageParam = 1 }) => recentTracks(pageParam, PAGE_SIZE),
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length === PAGE_SIZE ? allPages.length + 1 : undefined,
        initialPageParam: 1,
    });

    const rawQ = useInfiniteQuery({
        queryKey: ['history-raw-infinite'],
        queryFn: ({ pageParam = 1 }) => rawHistory(pageParam, PAGE_SIZE),
        getNextPageParam: (lastPage, allPages) =>
            lastPage.length === PAGE_SIZE ? allPages.length + 1 : undefined,
        initialPageParam: 1,
    });

    const clear = useMutation({
        mutationFn: clearHistory,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['history-artists'] });
            qc.invalidateQueries({ queryKey: ['history-tracks-infinite'] });
            qc.invalidateQueries({ queryKey: ['history-raw-infinite'] });
            setConfirmOpen(false);
        },
    });

    const exportJsonData = () => {
        const allData = rawQ.data?.pages.flat() || [];
        exportJson(allData);
    };

    return (
        <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-16">
            <header className="flex items-center justify-between border-b border-border pb-4">
                <h1 className="text-4xl font-bold tracking-tight text-fg">История</h1>
                <button
                    onClick={() => setConfirmOpen(true)}
                    disabled={clear.isPending}
                    className="flex items-center gap-2 rounded border border-border bg-bg px-4 py-2 text-sm font-medium hover:border-danger/50 hover:bg-danger/10 hover:text-danger transition-all disabled:opacity-50 shadow-sm"
                >
                    <TrashIcon className="size-4" />
                    Очистить
                </button>
            </header>

            {/* АРТИСТЫ */}
            {artists.data && artists.data.length > 0 && (
                <section className="space-y-4">
                    <h2 className="text-2xl font-bold tracking-tight text-fg">Недавние артисты</h2>
                    <ArtistSlider artists={artists.data as any} />
                </section>
            )}

            {/* ТРЕКИ */}
            <section className="space-y-4">
                <h2 className="text-2xl font-bold tracking-tight text-fg">Треки</h2>

                {tracksQ.data?.pages[0].length === 0 ? (
                    <p className="text-fg-muted">Ещё ничего не слушал.</p>
                ) : (
                    <>
                        <div className="rounded border border-border bg-bg-elevated overflow-hidden shadow-sm">
                            {tracksQ.data?.pages.map((page, i) => (
                                <ul key={i}>
                                    {page.map((t, idx) => (
                                        <TrackRow
                                            key={`${t.trackId}-${idx}`}
                                            track={{ ...t, id: t.trackId } as any}
                                            number={i * PAGE_SIZE + idx + 1}
                                        />
                                    ))}
                                </ul>
                            ))}
                        </div>

                        {tracksQ.hasNextPage && (
                            <div className="flex justify-center pt-4">
                                <button
                                    onClick={() => tracksQ.fetchNextPage()}
                                    disabled={tracksQ.isFetchingNextPage}
                                    className="flex items-center gap-2 rounded bg-accent/10 px-8 py-3 text-sm font-bold text-accent border border-accent/20 hover:bg-accent/20 transition-all disabled:opacity-50 shadow-sm"
                                >
                                    {tracksQ.isFetchingNextPage ? 'Загрузка...' : 'Показать еще'}
                                    <ChevronDownIcon className="size-4" />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* RAW */}
            <section className="space-y-4 pt-8">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold tracking-tight text-fg">События (Raw)</h2>
                    <button onClick={exportJsonData} className="text-sm font-medium text-accent hover:underline transition-all">
                        Экспорт JSON
                    </button>
                </div>

                {rawQ.data?.pages[0].length === 0 ? (
                    <p className="text-fg-muted">Нет событий за последнее время.</p>
                ) : (
                    <>
                        <div className="rounded border border-border bg-bg-elevated overflow-hidden shadow-sm">
                            {rawQ.data?.pages.map((page, i) => (
                                <ul key={i} className="divide-y divide-border/50">
                                    {page.map((e, idx) => (
                                        <li key={idx} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-accent/5 transition-colors group">
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate font-medium group-hover:text-accent transition-colors">{e.title}</div>
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
                            ))}
                        </div>

                        {rawQ.hasNextPage && (
                            <div className="flex justify-center pt-4">
                                <button
                                    onClick={() => rawQ.fetchNextPage()}
                                    disabled={rawQ.isFetchingNextPage}
                                    className="flex items-center gap-2 rounded bg-accent/10 px-8 py-3 text-sm font-bold text-accent border border-accent/20 hover:bg-accent/20 transition-all disabled:opacity-50 shadow-sm"
                                >
                                    {rawQ.isFetchingNextPage ? 'Загрузка...' : 'Показать еще'}
                                    <ChevronDownIcon className="size-4" />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* ОКНО ПОДТВЕРЖДЕНИЯ */}
            <ConfirmDialog
                isOpen={isConfirmOpen}
                title="Очистить историю?"
                message="Вы уверены, что хотите удалить всю историю прослушиваний? Это действие нельзя отменить."
                confirmText="Очистить"
                danger={true}
                onConfirm={() => clear.mutate()}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
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