import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { getFeed } from '@/shared/api/follows';
import { forYouTracks, popularTracks, trendingArtists } from '@/shared/api/recommendations';
import { listTracks, getTrackStatus } from '@/shared/api/catalog';
import { TrackRow } from './track-row';
import { usePlayer } from '@/features/player/store';
import type { TrackListItem } from '@/shared/types';
import { cn } from '@/shared/lib/cn';
import { useAlertStore } from '@/shared/store/alertStore';
import { ArtistSlider } from '@/shared/ui/ArtistSlider';

const scrollbarClasses = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-fg-muted/50";
const scrollableListClasses = cn("max-h-[400px] overflow-y-auto overflow-x-hidden rounded-md border border-border", scrollbarClasses);

export function HomePage() {
    const { user } = useAuth();
    const feed = useQuery({ queryKey: ['feed'], queryFn: () => getFeed(20) });
    const popular = useQuery({ queryKey: ['popular'], queryFn: () => popularTracks(15) });
    const forYou = useQuery({ queryKey: ['for-you'], queryFn: () => forYouTracks(15) });
    const artists = useQuery({ queryKey: ['trending-artists'], queryFn: () => trendingArtists(8) });

    const showAlert = useAlertStore((s) => s.showAlert);

    const popularEmpty = !popular.isLoading && (!popular.data || popular.data.length === 0);
    const catalog = useQuery({
        queryKey: ['catalog', 1],
        queryFn: () => listTracks(1, 15),
        enabled: popularEmpty,
    });

    const playQueueStore = usePlayer(s => s.playQueue);

    const handlePlayContext = async (
        list: TrackListItem[],
        index: number,
        context: import('@/features/player/store').PlaybackContext = { type: 'queue' },
    ) => {
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
                showAlert('Трек обрабатывается. Подождите...', 'Ошибка воспроизведения');
                return;
            }
            playQueueStore(playerTracks as any, 0, context);
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
        isLikedByMe: f.isLikedByMe ?? false,
        featuredArtists: f.featuredArtists ?? [],
    })) || [];

    return (
        <div className="relative z-10 space-y-8 px-6 pb-6 pt-2">
            <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-accent/30 to-transparent pointer-events-none z-[-1]" />

            <div className="pt-5">
                <h1 className="text-4xl font-bold tracking-tight text-left">
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
                                <TrackRow key={`feed-${t.id}-${i}`} number={i + 1} track={t as any} onPlay={() => handlePlayContext(feedTracks as any, i, { type: 'feed' })} />
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
                                <TrackRow key={`foryou-${t.id}-${i}`} track={t} onPlay={() => handlePlayContext(forYou.data!, i, { type: 'for-you' })} />
                            ))}
                        </ul>
                    </div>
                </Section>
            )}

            <Section
                title={popularEmpty ? 'Каталог' : 'Популярное'}
                actionTo="/search"
                actionState={{ scrollToCatalog: true }}
                actionLabel="Смотреть все"
            >
                <div className={scrollableListClasses}>
                    {popular.data && popular.data.length > 0 && (
                        <ul>
                            {popular.data.map((t, i) => (
                                <TrackRow key={`pop-${t.id}-${i}`} track={t} onPlay={() => handlePlayContext(popular.data!, i, { type: 'popular' })} />
                            ))}
                        </ul>
                    )}
                    {popularEmpty && catalog.data && catalog.data.length > 0 && (
                        <ul>
                            {catalog.data.map((t, i) => (
                                <TrackRow key={`cat-${t.id}-${i}`} track={t} onPlay={() => handlePlayContext(catalog.data!, i, { type: 'popular' })} />
                            ))}
                        </ul>
                    )}
                </div>
            </Section>
        </div>
    );
}

function Section({ title, actionTo, actionState, actionLabel, children }: { title: string; actionTo?: string; actionState?: any; actionLabel?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <header className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{title}</h2>
                {actionTo && <Link to={actionTo} state={actionState} className="text-xs font-medium text-accent hover:underline">{actionLabel}</Link>}
            </header>
            {children}
        </div>
    );
}