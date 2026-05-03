import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { getFeed, getFriendsFeed } from '@/shared/api/follows';
import { batchUsers } from '@/shared/api/users';
import { forYouTracks, popularTracks, trendingArtists } from '@/shared/api/recommendations';
import { listTracks } from '@/shared/api/catalog';
import { TrackRow } from './track-row';
import type { FriendFeedItem } from '@/shared/types';

export function HomePage() {
    const { user } = useAuth();

    const feed = useQuery({ queryKey: ['feed'], queryFn: () => getFeed(20) });
    const friendsFeed = useQuery({
        queryKey: ['friends-feed'],
        queryFn: () => getFriendsFeed(20),
    });
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
                    С возвращением, {user?.displayName ?? user?.email ?? 'Гость'}
                </h1>
            </header>

            {feed.data && feed.data.length > 0 && (
                <Section title="Лента">
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {feed.data.map((f, i) => (
                            <TrackRow
                                key={`feed-${f.trackId}-${i}`}
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

            {friendsFeed.data && friendsFeed.data.length > 0 && (
                <Section title="Лента подписок" actionTo="/friends" actionLabel="Все подписки">
                    <FriendsFeedList items={friendsFeed.data} />
                </Section>
            )}

            <Section title={popularEmpty ? 'Рекомендации' : 'Популярное'} actionTo="/catalog" actionLabel="Смотреть все">
                {popular.isLoading && <p className="text-fg-muted">Загрузка...</p>}

                {popular.data && popular.data.length > 0 && (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {popular.data.map((t, i) => (
                            <TrackRow key={`pop-${t.id}-${i}`} track={t} number={i + 1} />
                        ))}
                    </ul>
                )}

                {popularEmpty && catalog.data && catalog.data.length > 0 && (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {catalog.data.map((t, i) => (
                            <TrackRow key={`cat-${t.id}-${i}`} track={t} number={i + 1} />
                        ))}
                    </ul>
                )}

                {popularEmpty && catalog.isLoading && <p className="text-fg-muted">Загрузка...</p>}
                {popularEmpty && !catalog.isLoading && (!catalog.data || catalog.data.length === 0) && (
                    <p className="text-fg-muted">Каталог пуст.</p>
                )}
            </Section>

            {forYou.data && forYou.data.length > 0 && (
                <Section title="Специально для вас">
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {forYou.data.map((t, i) => (
                            <TrackRow key={`foryou-${t.id}-${i}`} track={t} number={i + 1} />
                        ))}
                    </ul>
                </Section>
            )}

            {artists.data && artists.data.length > 0 && (
                <Section title="В тренде">
                    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                        {artists.data.map((a, i) => (
                            <li key={`artist-${a.id}-${i}`}> {/* Уникальный ключ */}
                                <Link
                                    to={`/artists/${a.id}`}
                                    className="block space-y-2 rounded-md border border-border bg-bg-elevated p-3 hover:bg-bg-elevated/70"
                                >
                                    <div
                                        className="aspect-square w-full rounded-full bg-bg bg-cover bg-center flex items-center justify-center text-3xl font-bold text-fg-muted"
                                        style={{ backgroundImage: a.avatarUrl ? `url('${a.avatarUrl}')` : undefined }}
                                        aria-hidden={!!a.avatarUrl}
                                    >
                                        {!a.avatarUrl && a.name ? a.name.charAt(0).toUpperCase() : null}
                                    </div>
                                    <div className="truncate text-center text-sm font-medium">{a.name}</div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </Section>
            )}

            {!feed.data?.length &&
                !friendsFeed.data?.length &&
                !popular.data?.length &&
                !forYou.data?.length &&
                !artists.data?.length && (
                    <div className="rounded-md border border-border bg-bg-elevated p-6 text-fg-muted">
                        Пока что здесь пусто. Слушайте музыку, чтобы мы могли рекомендовать вам что-то новое!{' '}
                        <Link to="/catalog" className="text-accent hover:underline">
                            Перейти в каталог
                        </Link>{' '}
                        или воспользуйтесь поиском.
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

function FriendsFeedList({ items }: { items: FriendFeedItem[] }) {
    const userIds = Array.from(new Set(items.map((i) => i.userId)));

    const namesQ = useQuery({
        queryKey: ['user-names', ...userIds.sort()],
        queryFn: () => batchUsers(userIds),
        enabled: userIds.length > 0,
        staleTime: 5 * 60 * 1000,
    });

    const nameMap: Record<string, string> = {};
    for (const u of namesQ.data ?? []) nameMap[u.id] = u.displayName;

    return (
        <div className="space-y-2">
            {items.map((item, i) => {
                const friendName =
                    nameMap[item.userId] ?? `${item.userId.slice(0, 8)}…`;
                return (
                    <div
                        key={`friend-feed-${item.userId}-${item.track.id}-${i}`}
                        className="overflow-hidden rounded-md border border-border"
                    >
                        <div className="flex items-center justify-between gap-2 bg-bg-elevated/40 px-4 py-1.5 text-xs text-fg-muted">
                            <span>
                                <Link
                                    to={`/users/${item.userId}`}
                                    className="font-medium text-fg hover:underline"
                                >
                                    {friendName}
                                </Link>{' '}
                                слушал(а)
                            </span>
                            <span title={new Date(item.lastPlayedAt).toLocaleString('ru-RU')}>
                                {formatRelativeTime(item.lastPlayedAt)}
                            </span>
                        </div>
                        <ul>
                            <TrackRow track={item.track} />
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}

function formatRelativeTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const min = Math.round(diffMs / 60_000);
    if (min < 1) return 'только что';
    if (min < 60) return `${min} мин назад`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h} ч назад`;
    const days = Math.round(h / 24);
    if (days < 7) return `${days} дн назад`;
    return d.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
}