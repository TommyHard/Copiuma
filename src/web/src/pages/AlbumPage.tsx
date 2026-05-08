import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    deleteAlbum,
    deleteAlbumCover,
    getAlbum,
    listAlbumTracks,
    updateAlbum,
    uploadAlbumCover,
} from '@/shared/api/albums';
import { listGenres } from '@/shared/api/genres';
import { TrackRow } from './track-row';
import { usePlayer } from '@/features/player/store';
import { NowPlayingFromBadge } from '@/features/player/NowPlayingBadge';
import { useAuth } from '@/features/auth/useAuth';
import { ImageUploader } from '@/features/cover/ImageUploader';
import { cn } from '@/shared/lib/cn';
import type { AlbumSummary } from '@/shared/types';
import { useAlertStore } from '@/shared/store/alertStore';

export function AlbumPage() {
    const { id } = useParams();
    const qc = useQueryClient();
    const navigate = useNavigate();
    const { user } = useAuth();
    const playQueue = usePlayer((s) => s.playQueue);
    const [editOpen, setEditOpen] = useState(false);

    const showAlert = useAlertStore((s) => s.showAlert);

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

    const remove = useMutation({
        mutationFn: () => deleteAlbum(id!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['album', id] });
            navigate('/catalog');
        },
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
                            qc.setQueryData(['album', a.id], (prev: AlbumSummary | undefined) =>
                                prev ? { ...prev, coverUrl: updated.coverUrl } : prev);
                            qc.invalidateQueries({ queryKey: ['album', a.id] });
                            qc.invalidateQueries({ queryKey: ['album-tracks', a.id] });
                        }}
                        onDelete={async () => {
                            await deleteAlbumCover(a.id);
                            qc.invalidateQueries({ queryKey: ['album', a.id] });
                            qc.invalidateQueries({ queryKey: ['album-tracks', a.id] });
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
                    <div className="flex items-center gap-3">
                        <h1 className="truncate text-3xl font-semibold">{a.title}</h1>
                        {id && <NowPlayingFromBadge target={{ type: 'album', id }} label />}
                    </div>

                    {a.artistId && (
                        <Link to={`/artists/${a.artistId}`} className="text-sm text-fg-muted hover:text-fg">
                            {a.artistName ?? 'артист'}
                        </Link>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-fg-muted">
                        {a.releasedAt && (
                            <span title="Дата релиза">
                                Релиз {formatDateRu(a.releasedAt)}
                            </span>
                        )}
                        {a.createdAt && (
                            <>
                                {a.releasedAt && <span aria-hidden>•</span>}
                                <span title="Когда альбом загружен в каталог">
                                    Загружен {formatDateTimeRu(a.createdAt)}
                                </span>
                            </>
                        )}
                        {tracks.data && (
                            <>
                                <span aria-hidden>•</span>
                                <span>{tracks.data.length} {pluralTracks(tracks.data.length)}</span>
                            </>
                        )}
                    </div>

                    {a.genres && a.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {a.genres.map((g) => (
                                <span
                                    key={g}
                                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-fg-muted"
                                >
                                    {g}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-2">
                        {tracks.data && tracks.data.length > 0 && (
                            <button
                                onClick={() => playQueue(tracks.data!, 0, { type: 'album', id: id! })}
                                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
                            >
                                ▶ Играть альбом
                            </button>
                        )}
                        {isOwner && (
                            <>
                                <button
                                    onClick={() => setEditOpen(true)}
                                    className="rounded-md border border-border px-4 py-2 text-sm hover:bg-bg-elevated"
                                >
                                    Редактировать
                                </button>
                                <button
                                    onClick={() => {
                                        if (!tracks.data || tracks.data.length === 0) {
                                            if (confirm('Удалить пустой альбом?')) remove.mutate();
                                        } else {
                                            showAlert('Сначала открепите все треки от альбома.', 'Ошибка удаления');
                                        }
                                    }}
                                    disabled={remove.isPending}
                                    className="rounded-md border border-danger/40 px-4 py-2 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
                                >
                                    Удалить
                                </button>
                            </>
                        )}
                    </div>
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

            {isOwner && editOpen && (
                <AlbumEditDialog
                    album={a}
                    onClose={() => setEditOpen(false)}
                    onSaved={(updated) => {
                        qc.setQueryData(['album', a.id], updated);
                        qc.invalidateQueries({ queryKey: ['album', a.id] });
                        setEditOpen(false);
                    }}
                />
            )}
        </article>
    );
}

function AlbumEditDialog({
    album,
    onClose,
    onSaved,
}: {
    album: AlbumSummary;
    onClose: () => void;
    onSaved: (a: AlbumSummary) => void;
}) {
    const [title, setTitle] = useState(album.title);
    const [releaseDate, setReleaseDate] = useState<string>(
        album.releasedAt ? album.releasedAt.slice(0, 10) : '',
    );
    const [genres, setGenres] = useState<string[]>(album.genres ?? []);
    const [error, setError] = useState<string | null>(null);

    const genresQ = useQuery({
        queryKey: ['genres'],
        queryFn: listGenres,
        staleTime: 10 * 60 * 1000,
    });

    const save = useMutation({
        mutationFn: () =>
            updateAlbum(album.id, {
                title: title.trim(),
                releaseDate: releaseDate || null,
                genres,
            }),
        onSuccess: (data) => onSaved(data),
        onError: (err: any) => {
            const data = err?.response?.data;
            setError(typeof data === 'string' ? data : data?.message ?? 'Не удалось сохранить.');
        },
    });

    function toggleGenre(slug: string) {
        setGenres((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]));
    }

    function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!title.trim()) {
            setError('Название не может быть пустым.');
            return;
        }
        setError(null);
        save.mutate();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <form
                onSubmit={onSubmit}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg space-y-4 rounded-lg border border-border bg-bg p-6"
            >
                <header className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Редактирование альбома</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-fg-muted hover:text-fg"
                        aria-label="Закрыть"
                    >
                        ×
                    </button>
                </header>

                <label className="block">
                    <span className="mb-1 block text-sm text-fg-muted">Название *</span>
                    <input
                        type="text"
                        required
                        maxLength={200}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={save.isPending}
                        className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50"
                    />
                </label>

                <label className="block">
                    <span className="mb-1 block text-sm text-fg-muted">Дата релиза</span>
                    <input
                        type="date"
                        value={releaseDate}
                        onChange={(e) => setReleaseDate(e.target.value)}
                        disabled={save.isPending}
                        className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-fg outline-none focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50"
                    />
                </label>

                <div>
                    <span className="mb-2 block text-sm text-fg-muted">Жанры</span>
                    <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                        {(genresQ.data ?? []).map((g) => {
                            const selected = genres.includes(g.slug);
                            return (
                                <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => toggleGenre(g.slug)}
                                    disabled={save.isPending}
                                    className={cn(
                                        'rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50',
                                        selected
                                            ? 'border-accent bg-accent/15 text-accent'
                                            : 'border-border text-fg-muted hover:border-accent/50 hover:text-fg',
                                    )}
                                >
                                    {g.displayName}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {error && <p className="text-sm text-danger">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={save.isPending}
                        className="rounded-md border border-border px-4 py-2 text-sm hover:bg-bg-elevated disabled:opacity-50"
                    >
                        Отмена
                    </button>
                    <button
                        type="submit"
                        disabled={save.isPending}
                        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
                    >
                        {save.isPending ? 'Сохраняем…' : 'Сохранить'}
                    </button>
                </div>
            </form>
        </div>
    );
}

function formatDateRu(isoOrYmd: string): string {
    const d = new Date(isoOrYmd);
    if (Number.isNaN(d.getTime())) return isoOrYmd;
    return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTimeRu(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' });
}

function pluralTracks(n: number): string {
    const last2 = n % 100;
    const last1 = n % 10;
    if (last2 >= 11 && last2 <= 14) return 'треков';
    if (last1 === 1) return 'трек';
    if (last1 >= 2 && last1 <= 4) return 'трека';
    return 'треков';
}