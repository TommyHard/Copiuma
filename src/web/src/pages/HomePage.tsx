import { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { getFeed } from '@/shared/api/follows';
import { forYouTracks, popularTracks, trendingArtists } from '@/shared/api/recommendations';
import { listTracks, getTrackStatus } from '@/shared/api/catalog';
import { TrackRow } from './track-row';
import { usePlayer } from '@/features/player/store';
import { ArrowRightIcon } from '@/shared/ui/icons';
import type { TrackListItem } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

const scrollbarClasses = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-fg-muted/50";
const scrollableListClasses = cn("max-h-[400px] overflow-y-auto overflow-x-hidden rounded-md border border-border", scrollbarClasses);

export function HomePage() {
    const { user } = useAuth();
    const feed = useQuery({ queryKey: ['feed'], queryFn: () => getFeed(20) });
    const popular = useQuery({ queryKey: ['popular'], queryFn: () => popularTracks(15) });
    const forYou = useQuery({ queryKey: ['for-you'], queryFn: () => forYouTracks(15) });
    const artists = useQuery({ queryKey: ['trending-artists'], queryFn: () => trendingArtists(8) });

    const popularEmpty = !popular.isLoading && (!popular.data || popular.data.length === 0);
    const catalog = useQuery({
        queryKey: ['catalog', 1],
        queryFn: () => listTracks(1, 15),
        enabled: popularEmpty,
    });

    const playQueueStore = usePlayer(s => s.playQueue);

    const handlePlayContext = async (list: TrackListItem[], index: number) => {
        const sliced = list.slice(index);
        const playerTracks = sliced.map(t => ({
            id: t.id, title: t.title, artist: t.artist, duration: t.duration,
            uploadedAt: t.uploadedAt, artistId: t.artistId ?? null,
            albumId: t.albumId ?? null, trackNumber: t.trackNumber ?? null,
            isExplicit: t.isExplicit, coverUrl: t.coverUrl,
            isLikedByMe: t.isLikedByMe, featuredArtists: t.featuredArtists,
            hlsReady: true
        }));

        try {
            const st = await getTrackStatus(playerTracks[0].id);
            if (st.status !== 'Ready') {
                alert('Трек обрабатывается. Подождите...');
                return;
            }
            playQueueStore(playerTracks as any, 0);
        } catch (e) {
            console.error("Ошибка проверки статуса трека");
        }
    };

    const feedTracks = feed.data?.map(f => ({
        ...f,
        id: f.trackId,
        albumId: null,
        trackNumber: null,
        isExplicit: false,
        isLikedByMe: f.isLikedByMe ?? false
    })) || [];

    return(
        <div className="relative z-10 space-y-8 p-6">
            <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-accent/20 to-transparent pointer-events-none z-[-1]" />

            <div className="pt-8">
                <h1 className="text-2xl font-bold tracking-tight text-left">
                    Привет, {user?.displayName ?? user?.email ?? 'Гость'}
                </h1>
            </div>

            {artists.data && artists.data.length > 0 && (
                <Section title="Популярные артисты">
                    <ArtistSlider artists={artists.data} />
                </Section>
            )}

            <Section title="Лента подписок">
                {feed.isLoading && <p className="text-fg-muted">Загрузка ленты...</p>}
                {feed.data && feed.data.length > 0 ? (
                    <div className={scrollableListClasses}>
                        <ul>
                            {feedTracks.map((t, i) => (
                                <TrackRow key={`feed-${t.id}-${i}`} number={i + 1} track={t as any} onPlay={() => handlePlayContext(feedTracks as any, i)} />
                            ))}
                        </ul>
                    </div>
                ) : (
                    !feed.isLoading && (
                        <div className="rounded-md border border-border bg-bg p-6 text-center text-fg-muted">
                            Вы пока ни на кого не подписаны.
                        </div>
                    )
                )}
            </Section>

            {forYou.data && forYou.data.length > 0 && (
                <Section title="Для вас">
                    <div className={scrollableListClasses}>
                        <ul>
                            {forYou.data.map((t, i) => (
                                <TrackRow key={`foryou-${t.id}-${i}`} track={t} onPlay={() => handlePlayContext(forYou.data!, i)} />
                            ))}
                        </ul>
                    </div>
                </Section>
            )}

            <Section title={popularEmpty ? 'Каталог' : 'Популярное'} actionTo="/catalog" actionLabel="Смотреть все">
                <div className={scrollableListClasses}>
                    {popular.data && popular.data.length > 0 && (
                        <ul>
                            {popular.data.map((t, i) => (
                                <TrackRow key={`pop-${t.id}-${i}`} track={t} onPlay={() => handlePlayContext(popular.data!, i)} />
                            ))}
                        </ul>
                    )}
                    {popularEmpty && catalog.data && catalog.data.length > 0 && (
                        <ul>
                            {catalog.data.map((t, i) => (
                                <TrackRow key={`cat-${t.id}-${i}`} track={t} onPlay={() => handlePlayContext(catalog.data!, i)} />
                            ))}
                        </ul>
                    )}
                </div>
            </Section>
        </div>
    );
}

function Section({ title, actionTo, actionLabel, children }: { title: string; actionTo?: string; actionLabel?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <header className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{title}</h2>
                {actionTo && <Link to={actionTo} className="text-xs font-medium text-accent hover:underline">{actionLabel}</Link>}
            </header>
            {children}
        </div>
    );
}

function ArtistSlider({ artists }: { artists: import('@/shared/types').ArtistSummary[] }) {
    const scrollRef = useRef<HTMLUListElement>(null);
    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(true);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setShowLeft(scrollLeft > 0);
        setShowRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 2);
    };

    useEffect(() => {
        handleScroll();
        window.addEventListener('resize', handleScroll);
        return () => window.removeEventListener('resize', handleScroll);
    }, [artists]);

    const scroll = (dir: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const clientWidth = scrollRef.current.clientWidth;
        const scrollAmount = clientWidth * 0.75;
        scrollRef.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    };

    return (
        <div className="relative group/slider -mx-2 px-2">
            {showLeft && (
                <button onClick={() => scroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex size-8 items-center justify-center rounded-full border border-border bg-bg-elevated shadow-md text-fg hover:text-accent transition-all opacity-0 group-hover/slider:opacity-100">
                    <ArrowRightIcon className="rotate-180" />
                </button>
            )}
            <ul ref={scrollRef} onScroll={handleScroll} className="flex gap-4 overflow-x-auto scroll-smooth pb-6 pt-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                {artists.map((a, i) => (
                    <li key={`artist-${a.id}-${i}`} className="snap-start shrink-0">
                        <Link
                            to={`/artists/${a.id}`}
                            className="flex flex-col gap-4 w-[180px] p-4 rounded-xl hover:bg-fg/5 transition-all duration-200 group"
                        >
                            <div
                                className="w-full aspect-square rounded-full bg-bg-elevated shadow-md flex items-center justify-center text-5xl font-bold text-fg-muted overflow-hidden relative bg-cover bg-center border border-border/50 group-hover:shadow-xl transition-shadow"
                                style={{ backgroundImage: a.avatarUrl ? `url('${a.avatarUrl}')` : undefined }}
                            >
                                {!a.avatarUrl && a.name && <span>{a.name.charAt(0).toUpperCase()}</span>}
                            </div>
                            <div className="w-full text-left">
                                <div className="font-semibold text-fg text-base truncate">
                                    {a.name}
                                </div>
                                <div className="text-sm text-fg-muted mt-0.5">Артист</div>
                            </div>
                        </Link>
                    </li>
                ))}
            </ul>
            {showRight && (
                <button onClick={() => scroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex size-8 items-center justify-center rounded-full border border-border bg-bg-elevated shadow-md text-fg hover:text-accent transition-all opacity-0 group-hover/slider:opacity-100">
                    <ArrowRightIcon />
                </button>
            )}
        </div>
    );
}