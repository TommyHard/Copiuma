import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getGenreTracks } from '@/shared/api/genres';
import { TrackRow } from './track-row';
import { usePlayer } from '@/features/player/store';
import { cn } from '@/shared/lib/cn';
import { PlayIcon, MusicIcon } from '@/shared/ui/icons';

const PAGE_SIZE = 50;

const GRADIENTS = [
    'from-pink-500 to-rose-700',
    'from-amber-500 to-red-600',
    'from-emerald-500 to-teal-700',
    'from-sky-500 to-indigo-700',
    'from-purple-500 to-fuchsia-700',
    'from-yellow-500 to-orange-600',
    'from-lime-500 to-green-700',
    'from-cyan-500 to-blue-700',
    'from-violet-500 to-purple-700',
    'from-rose-500 to-pink-700',
    'from-orange-500 to-red-700',
    'from-teal-500 to-cyan-700',
];

export function gradientFromSlug(slug: string): string {
    let hash = 0;
    for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) | 0;
    return GRADIENTS[Math.abs(hash) % GRADIENTS.length];
}

export function GenrePage() {
    const { slug } = useParams();
    const [sort, setSort] = useState<'popular' | 'new'>('popular');
    const playQueue = usePlayer((s) => s.playQueue);

    const q = useQuery({
        queryKey: ['genre-tracks', slug, sort],
        queryFn: () => getGenreTracks(slug!, { take: PAGE_SIZE, sort }),
        enabled: !!slug,
    });

    if (q.isLoading) {
        return (
            <div className="flex h-full items-center justify-center p-12">
                <div className="size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
        );
    }

    if (q.isError || !q.data) {
        return <div className="p-8 text-danger text-center">Жанр не найден.</div>;
    }

    const { genre, total, items } = q.data;
    const gradient = gradientFromSlug(genre.slug);

    const handlePlayAll = () => {
        if (items.length === 0) return;
        const tracks = items.map(t => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            artistId: t.artistId ?? null,
            duration: t.duration,
            uploadedAt: t.uploadedAt,
            albumId: t.albumId ?? null,
            trackNumber: t.trackNumber ?? null,
            isExplicit: t.isExplicit,
            coverUrl: t.coverUrl ?? null,
            isLikedByMe: t.isLikedByMe,
            featuredArtists: t.featuredArtists,
            hlsReady: true,
        }));
        playQueue(tracks as any, 0, { type: 'queue' });
    };

    return (
        <article className="relative flex flex-col min-h-full pb-32">
            {/* BANNER */}
            <div className={cn(
                "relative w-full shrink-0 px-6 md:px-10 py-14 md:py-20 overflow-hidden",
                "bg-gradient-to-br text-white border-b border-border",
                gradient,
            )}>
                <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                <div className="relative z-10 flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">Жанр</span>
                    <h1 className="text-5xl md:text-7xl font-black tracking-tight">
                        {genre.displayName}
                    </h1>
                    <p className="mt-2 text-sm md:text-base opacity-90">
                        {total} {pluralTracks(total)}
                    </p>
                </div>
            </div>

            {/* TOOLBAR */}
            <div className="flex items-center gap-4 px-6 md:px-10 py-6">
                <button
                    onClick={handlePlayAll}
                    disabled={items.length === 0}
                    className="h-14 px-5 rounded font-black uppercase tracking-widest bg-accent text-white shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                >
                    <PlayIcon className="size-6" /> Играть
                </button>

                <div className="flex-1" />

                <div className="inline-flex rounded-lg border border-border bg-bg-elevated p-1 text-sm">
                    <button
                        onClick={() => setSort('popular')}
                        className={cn(
                            "px-3 py-1.5 rounded font-medium transition-colors",
                            sort === 'popular' ? "bg-accent text-white" : "text-fg-muted hover:text-fg"
                        )}
                    >
                        Популярные
                    </button>
                    <button
                        onClick={() => setSort('new')}
                        className={cn(
                            "px-3 py-1.5 rounded font-medium transition-colors",
                            sort === 'new' ? "bg-accent text-white" : "text-fg-muted hover:text-fg"
                        )}
                    >
                        Новые
                    </button>
                </div>
            </div>

            {/* TRACKS */}
            <div className="px-6 md:px-10 pb-10">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center py-20 text-center text-fg-muted">
                        <MusicIcon className="size-12 opacity-40 mb-4" />
                        <p>Пока нет треков с этим жанром.</p>
                    </div>
                ) : (
                    <ul className="rounded-lg border border-border bg-bg-elevated/40 overflow-hidden">
                        {items.map((t, i) => (
                            <TrackRow
                                key={t.id}
                                track={t}
                                number={i + 1}
                                playList={items}
                                playListIndex={i}
                                playListContext={{ type: 'queue' }}
                            />
                        ))}
                    </ul>
                )}
            </div>
        </article>
    );
}

function pluralTracks(n: number): string {
    const last2 = n % 100;
    const last1 = n % 10;
    if (last2 >= 11 && last2 <= 14) return 'треков';
    if (last1 === 1) return 'трек';
    if (last1 >= 2 && last1 <= 4) return 'трека';
    return 'треков';
}