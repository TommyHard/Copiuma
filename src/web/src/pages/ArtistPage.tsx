import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    deleteArtistAvatar,
    getArtist,
    listArtistAlbums,
    listArtistTracks,
    uploadArtistAvatar,
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

    if (artist.isLoading) return <p className="text-fg-muted">Загружаем…</p>;
    if (artist.isError || !artist.data) return <p className="text-danger">Артист не найден.</p>;

    const a = artist.data;
    const isOwner = !!user && !!a.ownerUserId && user.id === a.ownerUserId;

    return (
        <article className="space-y-10">
            <header className="flex flex-wrap items-center gap-6">
                {isOwner ? (
                    <ImageUploader
                        currentUrl={a.avatarUrl}
                        shape="circle"
                        label="Аватар"
                        onUpload={async (f) => {
                            const updated = await uploadArtistAvatar(a.id, f);
                            qc.setQueryData(['artist', a.id], updated);
                        }}
                        onDelete={async () => {
                            const updated = await deleteArtistAvatar(a.id);
                            qc.setQueryData(['artist', a.id], updated);
                        }}
                    />
                ) : (
                    <div
                        className="size-32 shrink-0 rounded-full border border-border bg-bg-elevated bg-cover bg-center"
                        style={{ backgroundImage: a.avatarUrl ? `url(${a.avatarUrl})` : undefined }}
                        aria-hidden
                    />
                )}

                <div className="min-w-0 flex-1 space-y-2">
                    <h1 className="truncate text-3xl font-semibold">{a.name}</h1>
                    {typeof a.followers === 'number' && (
                        <p className="text-sm text-fg-muted">{a.followers} подписчиков</p>
                    )}
                    {a.bio && <p className="text-sm text-fg-muted">{a.bio}</p>}
                    <div className="flex flex-wrap gap-2 pt-2">
                        {!isOwner && <FollowArtistButton artistId={a.id} />}
                        {tracks.data && tracks.data.length > 0 && (
                            <button
                                onClick={() => playQueue(tracks.data!, 0)}
                                className="rounded-md border border-border px-4 py-2 text-sm hover:bg-bg-elevated"
                            >
                                ▶ Играть всё
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {albums.data && albums.data.length > 0 && (
                <section className="space-y-3">
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

            <section className="space-y-3">
                <h2 className="text-xl font-semibold">Треки</h2>
                {tracks.isLoading && <p className="text-fg-muted">Загружаем…</p>}
                {tracks.data && tracks.data.length === 0 && (
                    <p className="text-fg-muted">У этого артиста пока нет треков.</p>
                )}
                {tracks.data && tracks.data.length > 0 && (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {tracks.data.map((t, i) => (
                            <TrackRow key={t.id} track={t} number={i + 1} />
                        ))}
                    </ul>
                )}
            </section>
        </article>
    );
}