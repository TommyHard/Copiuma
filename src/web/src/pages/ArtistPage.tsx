import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    deleteArtistAvatar,
    deleteArtistBanner,
    getArtist,
    listArtistAlbums,
    listArtistTracks,
    updateArtist,
    uploadArtistAvatar,
    uploadArtistBanner,
} from '@/shared/api/artists';
import { FollowArtistButton } from '@/features/follows/FollowArtistButton';
import { TrackRow } from './track-row';
import { usePlayer } from '@/features/player/store';
import { useAuth } from '@/features/auth/useAuth';
import { ImageUploader } from '@/features/cover/ImageUploader';

export function ArtistPage() {
    const { id } = useParams();
    const qc = useQueryClient();
    const { user } = useAuth();
    const playQueue = usePlayer((s) => s.playQueue);

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

    const [editingBio, setEditingBio] = useState(false);
    const [bioText, setBioText] = useState('');

    const saveBio = useMutation({
        mutationFn: (bio: string) => updateArtist(id!, { bio }),
        onSuccess: (data) => {
            qc.setQueryData(['artist', id], data);
            setEditingBio(false);
        },
    });

    if (artist.isLoading) return <p className="text-fg-muted">Загрузка...</p>;
    if (artist.isError || !artist.data) return <p className="text-danger">Ошибка загрузки артиста.</p>;

    const a = artist.data;
    const isOwner = !!user && !!(a.ownerUserId ?? a.createdByUserId) && user.id === (a.ownerUserId ?? a.createdByUserId);

    function formatNumber(n: number): string {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return String(n);
    }

    return (
        <article className="space-y-10">
            {/* HEADER INFO */}
            <header className="flex flex-wrap items-end gap-6 px-2 pt-4">
                <div className="relative shrink-0">
                    {isOwner ? (
                        <ImageUploader
                            currentUrl={a.avatarUrl}
                            shape="circle"
                            label="Аватар"
                            onUpload={async (f) => {
                                await uploadArtistAvatar(a.id, f);
                                qc.invalidateQueries({ queryKey: ['artist', a.id] });
                            }}
                            onDelete={async () => {
                                await deleteArtistAvatar(a.id);
                                qc.invalidateQueries({ queryKey: ['artist', a.id] });
                            }}
                        />
                    ) : (
                        <div
                            className="size-24 rounded-full border-4 border-bg bg-bg-elevated bg-cover bg-center shadow-md md:size-32"
                            style={{ backgroundImage: a.avatarUrl ? `url('${a.avatarUrl}')` : undefined }}
                            aria-hidden
                        />
                    )}
                </div>

                <div className="space-y-3 pb-2">
                    <h1 className="text-3xl font-bold tracking-tight">{a.name}</h1>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-fg-muted">
                        {typeof a.monthlyListeners === 'number' && (
                            <span>{formatNumber(a.monthlyListeners)} слушателей в месяц</span>
                        )}
                        {typeof a.followers === 'number' && (
                            <span>{formatNumber(a.followers)} подписчиков</span>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                        {!isOwner && <FollowArtistButton artistId={a.id} />}
                        {tracks.data && tracks.data.length > 0 && (
                            <button
                                onClick={() => playQueue(tracks.data!, 0)}
                                className="rounded-md bg-accent px-4 py-2 text-sm text-accent-fg hover:opacity-90"
                            >
                                Слушать все
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* ABOUT */}
            <section className="relative mt-8 overflow-hidden rounded-lg border border-border">
                <div className="relative grid">
                    <div className="col-start-1 row-start-1 h-full w-full">
                        {isOwner ? (
                            <ImageUploader
                                currentUrl={a.bannerUrl}
                                shape="banner"
                                label="Фон секции 'Об артисте'"
                                onUpload={async (f) => {
                                    await uploadArtistBanner(a.id, f);
                                    qc.invalidateQueries({ queryKey: ['artist', a.id] });
                                }}
                                onDelete={async () => {
                                    await deleteArtistBanner(a.id);
                                    qc.invalidateQueries({ queryKey: ['artist', a.id] });
                                }}
                            />
                        ) : (
                            <div
                                className="h-full w-full bg-bg-elevated bg-cover bg-center"
                                style={{ backgroundImage: a.bannerUrl ? `url('${a.bannerUrl}')` : undefined }}
                                aria-hidden
                            />
                        )}
                        <div className="absolute inset-0 bg-black/60 pointer-events-none" />
                    </div>

                    <div className="col-start-1 row-start-1 relative z-10 p-6 flex flex-col justify-center pointer-events-none">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-semibold text-white">Об артисте</h2>
                            {isOwner && !editingBio && (
                                <button
                                    onClick={() => { setBioText(a.bio ?? ''); setEditingBio(true); }}
                                    className="text-xs text-accent hover:underline relative z-20 pointer-events-auto"
                                >
                                    Редактировать
                                </button>
                            )}
                        </div>

                        {editingBio ? (
                            <div className="space-y-2 mt-3 relative z-20 pointer-events-auto">
                                <textarea
                                    value={bioText}
                                    onChange={(e) => setBioText(e.target.value)}
                                    maxLength={4000}
                                    rows={5}
                                    className="w-full max-w-xl rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
                                    placeholder="Расскажите о себе..."
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => saveBio.mutate(bioText)}
                                        disabled={saveBio.isPending}
                                        className="rounded-md bg-accent px-3 py-1.5 text-xs text-accent-fg hover:opacity-90 disabled:opacity-50"
                                    >
                                        {saveBio.isPending ? 'Сохранение...' : 'Сохранить'}
                                    </button>
                                    <button
                                        onClick={() => setEditingBio(false)}
                                        className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-bg-elevated text-white"
                                    >
                                        Отмена
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="max-w-2xl whitespace-pre-wrap text-sm text-gray-200 mt-3 relative z-20 pointer-events-auto">
                                {a.bio || 'Здесь пока ничего нет.'}
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/* ALBUMS */}
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
                                        style={{ backgroundImage: al.coverUrl ? `url(${al.coverUrl})` : undefined }}
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

            {/* ALL TRACKS */}
            <section className="space-y-3 px-2">
                <h2 className="text-xl font-semibold">Треки</h2>
                {tracks.isLoading && <p className="text-fg-muted">Загрузка...</p>}
                {tracks.data && tracks.data.length === 0 && (
                    <p className="text-fg-muted">Нет треков.</p>
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
        </article>
    );
}