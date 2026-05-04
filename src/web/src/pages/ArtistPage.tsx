import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getArtist,
    listArtistAlbums,
    listArtistFeaturedOn,
    listArtistTracks,
} from '@/shared/api/artists';
import { FollowArtistButton } from '@/features/follows/FollowArtistButton';
import { TrackRow } from './track-row';
import { usePlayer } from '@/features/player/store';
import { useAuth } from '@/features/auth/useAuth';
import { blockArtist, unblockArtist } from '@/shared/api/blocks';
import { cn } from '@/shared/lib/cn';

export function ArtistPage() {
    const { id } = useParams();
    const qc = useQueryClient();
    const playQueue = usePlayer((s) => s.playQueue);
    const { user } = useAuth();

    const artist = useQuery({
        queryKey: ['artist', id],
        queryFn: () => getArtist(id!),
        enabled: !!id,
    });

    const albums = useQuery({
        queryKey: ['artist-albums', id],
        queryFn: () => listArtistAlbums(id!),
        enabled: !!id,
    });

    const tracks = useQuery({
        queryKey: ['artist-tracks', id],
        queryFn: () => listArtistTracks(id!),
        enabled: !!id,
    });

    const featuredOn = useQuery({
        queryKey: ['artist-featured-on', id],
        queryFn: () => listArtistFeaturedOn(id!),
        enabled: !!id,
    });

    const a = artist.data;
    const isBlocked = a?.isBlockedByMe ?? false;
    const isOwner = !!user && !!(a?.ownerUserId ?? a?.createdByUserId) && user.id === (a?.ownerUserId ?? a?.createdByUserId);

    const toggleBlock = useMutation({
        mutationFn: () => isBlocked ? unblockArtist(id!) : blockArtist(id!),
        onMutate: async () => {
            await qc.cancelQueries({ queryKey: ['artist', id] });
            const prev = qc.getQueryData(['artist', id]);
            qc.setQueryData(['artist', id], (old: any) => old ? { ...old, isBlockedByMe: !isBlocked } : old);
            return { prev };
        },
        onError: (err, vars, ctx) => {
            if (ctx?.prev) qc.setQueryData(['artist', id], ctx.prev);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ['recommendations'] });
            qc.invalidateQueries({ queryKey: ['trending-artists'] });
            qc.invalidateQueries({ queryKey: ['for-you'] });
            qc.invalidateQueries({ queryKey: ['feed'] });
            qc.invalidateQueries({ queryKey: ['catalog'] });
        },
    });

    if (artist.isLoading) return <p className="text-fg-muted">Загрузка...</p>;
    if (artist.isError || !a) return <p className="text-danger">Ошибка загрузки профиля.</p>;

    function formatNumber(n: number): string {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return String(n);
    }

    return (
        <article className="space-y-10">
            {/* ИНФОРМАЦИЯ В ШАПКЕ */}
            <header className="flex flex-wrap items-end gap-6 px-2 pt-4">
                <div className="relative shrink-0">
                    <div
                        className="size-24 rounded-full border-4 border-bg bg-bg-elevated bg-cover bg-center shadow-md md:size-32"
                        style={{ backgroundImage: a.avatarUrl ? `url('${a.avatarUrl}')` : undefined }}
                        aria-hidden
                    />
                </div>
                <div className="space-y-3 pb-2">
                    <h1 className="text-3xl font-bold tracking-tight">{a.name}</h1>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-fg-muted">
                        {typeof a.monthlyListeners === 'number' && (
                            <span>{formatNumber(a.monthlyListeners)} слушателей</span>
                        )}
                        {typeof a.followers === 'number' && (
                            <span>{formatNumber(a.followers)} фолловеров</span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {!isOwner && (
                            <button
                                onClick={() => toggleBlock.mutate()}
                                disabled={toggleBlock.isPending}
                                className={cn(
                                    "rounded-md border px-4 py-2 text-sm transition-colors disabled:opacity-50",
                                    isBlocked
                                        ? "border-danger text-danger bg-danger/10 hover:bg-danger/20"
                                        : "border-border hover:bg-bg-elevated text-fg-muted hover:text-danger"
                                )}
                            >
                                {isBlocked ? 'Разблокировать' : 'Заблокировать'}
                            </button>
                        )}
                        {!isBlocked && tracks.data && tracks.data.length > 0 && (
                            <button onClick={() => playQueue(tracks.data!, 0)} className="rounded-md bg-accent px-4 py-2 text-sm text-accent-fg hover:opacity-90">
                                Слушать всё
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* ПЛАШКА БЛОКИРОВКИ */}
            {isBlocked && (
                <div className="rounded-md border border-danger/40 bg-danger/10 p-4 text-danger flex items-center gap-3">
                    <span className="text-2xl">🚫</span>
                    <div className="text-sm">
                        <strong>Вы заблокировали этого артиста.</strong> Его контент больше не появляется в ваших рекомендациях, ленте и поиске.
                        Здесь вы по-прежнему можете просматривать его дискографию.
                    </div>
                </div>
            )}

            {/* ОБ АРТИСТЕ */}
            <section className="relative mt-8 overflow-hidden rounded-lg border border-border">
                <div className="relative grid">
                    <div className="col-start-1 row-start-1 h-full w-full">
                        <div
                            className="h-full w-full bg-bg-elevated bg-cover bg-center"
                            style={{ backgroundImage: a.bannerUrl ? `url('${a.bannerUrl}')` : undefined }}
                            aria-hidden
                        />
                        <div className="absolute inset-0 bg-black/60 pointer-events-none" />
                    </div>
                    <div className="col-start-1 row-start-1 relative z-10 p-6 flex flex-col justify-center pointer-events-none">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-semibold text-white">Об артисте</h2>
                        </div>
                        <p className="max-w-2xl whitespace-pre-wrap text-sm text-gray-200 mt-3 relative z-20 pointer-events-auto">
                            {a.bio || 'Нет информации об артисте.'}
                        </p>
                    </div>
                </div>
            </section>

            {/* АЛЬБОМЫ */}
            {albums.data && albums.data.length > 0 && (
                <section className="space-y-3 px-2">
                    <h2 className="text-xl font-semibold">Альбомы</h2>
                    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                        {albums.data.map((al) => (
                            <li key={al.id}>
                                <Link
                                    to={`/albums/${al.id}`}
                                    className="block space-y-2 rounded-md border border-border bg-bg-elevated p-3 hover:bg-bg-elevated/70"
                                >
                                    <div
                                        className="aspect-square w-full rounded bg-bg bg-cover bg-center"
                                        style={{ backgroundImage: al.coverUrl ? `url('${al.coverUrl}')` : undefined }}
                                        aria-hidden
                                    />
                                    <div className="truncate text-sm font-medium">{al.title}</div>
                                    {al.releasedAt && (
                                        <div className="text-xs text-fg-muted">
                                            {new Date(al.releasedAt).getFullYear()}
                                        </div>
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {/* ТРЕКИ */}
            <section className="space-y-3 px-2">
                <h2 className="text-xl font-semibold">Треки</h2>
                {tracks.isLoading && <p className="text-fg-muted">Загрузка...</p>}
                {tracks.data && tracks.data.length === 0 && (
                    <p className="text-fg-muted">У артиста пока нет треков.</p>
                )}
                {tracks.data && tracks.data.length > 0 && (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {tracks.data.map((t, i) => (
                            <TrackRow
                                key={t.id}
                                track={{ ...t, artist: t.artist ?? a.name, artistId: t.artistId ?? a.id }}
                                number={i + 1}
                            />
                        ))}
                    </ul>
                )}
            </section>

            {/* FEATURED */}
            {featuredOn.data && featuredOn.data.length > 0 && (
                <section className="space-y-3 px-2">
                    <div className="flex items-baseline gap-3">
                        <h2 className="text-xl font-semibold">Участие как feat.</h2>
                    </div>
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {featuredOn.data.map((t, i) => (
                            <TrackRow key={`feat-${t.id}`} track={t} number={i + 1} />
                        ))}
                    </ul>
                </section>
            )}
        </article>
    );
}