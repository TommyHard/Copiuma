import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteAlbumCover, getAlbum, listAlbumTracks, uploadAlbumCover } from '@/shared/api/albums';
import { TrackRow } from './track-row';
import { usePlayer } from '@/features/player/store';
import { useAuth } from '@/features/auth/useAuth';
import { ImageUploader } from '@/features/cover/ImageUploader';

export function AlbumPage() {
    const { id } = useParams();
    const qc = useQueryClient();
    const { user } = useAuth();
    const playQueue = usePlayer((s) => s.playQueue);

    const album = useQuery({
        queryKey: ['album', id],
        queryFn: () => getAlbum(id!),
        enabled: !!id,
    });

    const tracks = useQuery({
        queryKey: ['album-tracks', id],
        queryFn: () => listAlbumTracks(id!),
        enabled: !!id,
    });

    if (album.isLoading) return <p className="text-fg-muted">Загружаем…</p>;
    if (album.isError || !album.data) return <p className="text-danger">Альбом не найден.</p>;

    const a = album.data;
    const isOwner = !!user && !!a.ownerUserId && user.id === a.ownerUserId;

    return (
        <article className="space-y-8">
            <header className="flex flex-wrap items-end gap-6">
                {isOwner ? (
                    <ImageUploader
                        currentUrl={a.coverUrl}
                        label="Обложка"
                        onUpload={async (f) => {
                            const updated = await uploadAlbumCover(a.id, f);
                            qc.setQueryData(['album', a.id], updated);
                        }}
                        onDelete={async () => {
                            const updated = await deleteAlbumCover(a.id);
                            qc.setQueryData(['album', a.id], updated);
                        }}
                    />
                ) : (
                    <div
                        className="size-48 shrink-0 rounded-md border border-border bg-bg-elevated bg-cover bg-center"
                        style={{ backgroundImage: a.coverUrl ? `url(${a.coverUrl})` : undefined }}
                        aria-hidden
                    />
                )}

                <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-fg-muted">Альбом</p>
                    <h1 className="truncate text-3xl font-semibold">{a.title}</h1>
                    {a.artistId && (
                        <Link to={`/artists/${a.artistId}`} className="text-sm text-fg-muted hover:text-fg">
                            {a.artistName ?? 'артист'}
                        </Link>
                    )}
                    {a.releasedAt && (
                        <p className="text-sm text-fg-muted">
                            Релиз {new Date(a.releasedAt).getFullYear()}
                        </p>
                    )}
                    {tracks.data && tracks.data.length > 0 && (
                        <div className="pt-2">
                            <button
                                onClick={() => playQueue(tracks.data!, 0)}
                                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
                            >
                                ▶ Играть альбом
                            </button>
                        </div>
                    )}
                </div>
            </header>

            <section className="space-y-3">
                {tracks.isLoading && <p className="text-fg-muted">Загружаем…</p>}
                {tracks.data && tracks.data.length === 0 && (
                    <p className="text-fg-muted">В альбоме нет треков.</p>
                )}
                {tracks.data && tracks.data.length > 0 && (
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {tracks.data.map((t, i) => (
                            <TrackRow key={t.id} track={t} number={t.trackNumber ?? i + 1} />
                        ))}
                    </ul>
                )}
            </section>
        </article>
    );
}