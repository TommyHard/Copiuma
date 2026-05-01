import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { getFeed } from '@/shared/api/follows';
import { forYouTracks, popularTracks, trendingArtists } from '@/shared/api/recommendations';
import { listTracks } from '@/shared/api/catalog';
import { TrackRow } from './track-row';

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

    return (
        <div className="space-y-12">
            <header>
                <h1 className="text-3xl font-semibold tracking-tight">
                    Привет, {user?.displayName ?? user?.email ?? 'друг'}.
                </h1>
            </header>

            {feed.data && feed.data.length > 0 && (
                <Section title="Новое от твоих артистов">
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {feed.data.map((f, i) => (
                            <TrackRow
                                key={f.trackId}
                                number={i + 1}
                                track={{
                                    id: f.trackId,
                                    title: f.title,
                                    artist: f.artist,
                                    duration: f.duration,
                                    uploadedAt: f.uploadedAt,
                                    artistId: f.artistId,
                                    albumId: null,
                                    trackNumber: null,
                                    isExplicit: false,
                                }}
                            />
                        ))}
                    </ul>
                </Section>
            )}

            <Section title={popularEmpty ? 'Новые треки' : 'Популярное'} actionTo="/catalog" actionLabel="Весь каталог →">
                {popular.isLoading && <p className="text-fg-muted">Загружаем…</p>}
                {popular.data && popular.data.length > 0 && (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {popular.data.map((t, i) => (
                            <TrackRow key={t.id} track={t} number={i + 1} />
                        ))}
                    </ul>
                )}
                {popularEmpty && catalog.data && catalog.data.length > 0 && (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {catalog.data.map((t, i) => (
                            <TrackRow key={t.id} track={t} number={i + 1} />
                        ))}
                    </ul>
                )}
                {popularEmpty && catalog.isLoading && <p className="text-fg-muted">Загружаем…</p>}
                {popularEmpty && !catalog.isLoading && (!catalog.data || catalog.data.length === 0) && (
                    <p className="text-fg-muted">Пока нет треков. Загляни в каталог.</p>
                )}
            </Section>

            {forYou.data && forYou.data.length > 0 && (
                <Section title="Для тебя">
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {forYou.data.map((t, i) => (
                            <TrackRow key={t.id} track={t} number={i + 1} />
                        ))}
                    </ul>
                </Section>
            )}

            {artists.data && artists.data.length > 0 && (
                <Section title="Артисты на подъёме">
                    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                        {artists.data.map((a) => (
                            <li key={a.id}>
                                <Link
                                    to={`/artists/${a.id}`}
                                    className="block space-y-2 rounded-md border border-border bg-bg-elevated p-3 hover:bg-bg-elevated/70"
                                >
                                    <div
                                        className="aspect-square w-full rounded-full bg-bg bg-cover bg-center"
                                        style={{ backgroundImage: a.avatarUrl ? `url(${a.avatarUrl})` : undefined }}
                                        aria-hidden
                                    />
                                    <div className="truncate text-center text-sm font-medium">{a.name}</div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {/* fallback: если все секции пустые */}
            {!feed.data?.length &&
                !popular.data?.length &&
                !forYou.data?.length &&
                !artists.data?.length && (
                    <div className="rounded-md border border-border bg-bg-elevated p-6 text-fg-muted">
                        Пока пусто. Загляни в{' '}
                        <Link to="/catalog" className="text-accent hover:underline">
                            каталог
                        </Link>{' '}
                        или подпишись на пару артистов, чтобы наполнить ленту.
                    </div>
                )}
        </div>
    );
}

function Section({
    title,
    actionTo,
    actionLabel,
    children,
}: {
    title: string;
    actionTo?: string;
    actionLabel?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-3">
            <header className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{title}</h2>
                {actionTo && (
                    <Link to={actionTo} className="text-sm text-accent hover:underline">
                        {actionLabel}
                    </Link>
                )}
            </header>
            {children}
        </section>
    );
}