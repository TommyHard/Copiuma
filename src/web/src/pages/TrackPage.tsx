import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTrack, getTrackStatus } from '@/shared/api/catalog';
import { deleteTrack, deleteTrackCover, toggleLike, uploadTrackCover } from '@/shared/api/tracks';
import { dislikeTrack } from '@/shared/api/dislikes';
import { similarTracks } from '@/shared/api/recommendations';
import { listGenres } from '@/shared/api/genres';
import { usePlayTrack } from '@/features/player/usePlayTrack';
import { Waveform } from '@/features/track/Waveform';
import { TrackRow } from './track-row';
import { useAuth } from '@/features/auth/useAuth';
import { StarRating } from '@/features/ratings/StarRating';
import { Reviews } from '@/features/reviews/Reviews';
import { ReportButton } from '@/features/reports/ReportButton';
import { TrackEditDialog } from '@/features/track/TrackEditDialog';
import { ImageUploader } from '@/features/cover/ImageUploader';
import { useToggleOfflineForTrack } from './OfflinePage';

export function TrackPage() {
    const { id } = useParams();
    const qc = useQueryClient();
    const navigate = useNavigate();
    const play = usePlayTrack();
    const { user } = useAuth();
    const [editOpen, setEditOpen] = useState(false);

    const trackQ = useQuery({
        queryKey: ['track', id],
        queryFn: () => getTrack(id!),
        enabled: !!id,
    });

    const statusQ = useQuery({
        queryKey: ['track-status', id],
        queryFn: () => getTrackStatus(id!),
        enabled: !!id,
        refetchInterval: (query) => (query.state.data?.status === 'Ready' ? false : 3000),
    });

    const similarQ = useQuery({
        queryKey: ['similar', id],
        queryFn: () => similarTracks(id!, 10),
        enabled: !!id && statusQ.data?.status === 'Ready',
    });

    const genresQ = useQuery({
        queryKey: ['genres'],
        queryFn: listGenres,
        staleTime: 10 * 60 * 1000,
    });

    const like = useMutation({
        mutationFn: () => toggleLike(id!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['favorites'] });
            qc.invalidateQueries({ queryKey: ['track', id] });
        },
    });

    const remove = useMutation({
        mutationFn: () => deleteTrack(id!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['catalog'] });
            qc.invalidateQueries({ queryKey: ['favorites'] });
            navigate('/catalog');
        },
    });

    const dislike = useMutation({
        mutationFn: () => dislikeTrack(id!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['recommendations'] });
            qc.invalidateQueries({ queryKey: ['for-you'] });
        },
    });

    const offline = useToggleOfflineForTrack(id ?? '');

    if (trackQ.isLoading) return <p className="text-fg-muted">Загружаем…</p>;
    if (trackQ.isError || !trackQ.data) return <p className="text-danger">Трек не найден.</p>;

    const t = trackQ.data;
    const ready = statusQ.data?.status === 'Ready';
    const isOwner = !!user && !!t.uploadedByUserId && user.id === t.uploadedByUserId;

    const genreLabel = (slug: string) =>
        genresQ.data?.find((g) => g.slug === slug)?.displayName ?? slug;

    return (
        <article className="space-y-10">
            <header className="flex flex-wrap items-start gap-6">
                {isOwner ? (
                    <div className="space-y-1">
                        <ImageUploader
                            currentUrl={t.coverUrl ?? null}
                            label="Обложка"
                            onUpload={async (f) => {
                                await uploadTrackCover(t.id, f);
                                qc.invalidateQueries({ queryKey: ['track', id] });
                            }}
                            onDelete={t.hasOwnCover ? async () => {
                                await deleteTrackCover(t.id);
                                qc.invalidateQueries({ queryKey: ['track', id] });
                            } : undefined}
                        />
                        {t.hasOwnCover ? (
                            <p className="text-[10px] text-fg-muted">собственная обложка</p>
                        ) : t.coverUrl ? (
                            <p className="text-[10px] text-fg-muted">наследуется от альбома</p>
                        ) : null}
                    </div>
                ) : (
                    <div
                        className="size-32 shrink-0 rounded-md border border-border bg-bg-elevated bg-cover bg-center"
                        style={{ backgroundImage: t.coverUrl ? `url(${t.coverUrl})` : undefined }}
                        aria-hidden
                    />
                )}

                <div className="min-w-0 flex-1 space-y-2">
                    <h1 className="text-3xl font-semibold">{t.title}</h1>
                    <div className="flex flex-wrap items-baseline gap-x-1 gap-y-1 text-sm">
                        {t.artistId ? (
                            <Link to={`/artists/${t.artistId}`} className="text-fg-muted hover:text-fg">
                                {t.artist ?? '—'}
                            </Link>
                        ) : (
                            <span className="text-fg-muted">{t.artist ?? '—'}</span>
                        )}

                        {t.featuredArtists && t.featuredArtists.length > 0 && (
                            <span className="text-fg-muted">
                                feat.{' '}
                                {t.featuredArtists.map((fa, idx) => (
                                    <span key={fa.id}>
                                        {idx > 0 && ', '}
                                        <Link
                                            to={`/artists/${fa.id}`}
                                            className="hover:text-fg hover:underline"
                                        >
                                            {fa.name}
                                        </Link>
                                    </span>
                                ))}
                            </span>
                        )}

                        {t.albumId && (
                            <>
                                <span className="text-fg-muted">•</span>
                                <Link
                                    to={`/albums/${t.albumId}`}
                                    className="text-fg-muted hover:text-fg"
                                    title={t.albumTitle ?? undefined}>
                                    {t.albumTitle ?? 'альбом'}
                                    {t.trackNumber ? ` • #${t.trackNumber}` : ''}
                                </Link>
                            </>
                        )}
                        {t.isExplicit && (
                            <span className="rounded bg-fg/15 px-1.5 py-0.5 text-[10px] uppercase text-fg-muted">
                                explicit
                            </span>
                        )}
                    </div>

                    {t.genres && t.genres.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {t.genres.map((slug) => (
                                <span
                                    key={slug}
                                    className="rounded-full border border-border px-4 py-0.5 text-[11px] text-fg-muted"
                                >
                                    {genreLabel(slug)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            {ready && id && <Waveform trackId={id} className="h-24 w-full" />}

            <div className="flex flex-wrap items-start gap-3">
                <button
                    disabled={!ready}
                    onClick={() =>
                        play({
                            id: t.id,
                            title: t.title,
                            artist: t.artist,
                            duration: t.duration,
                            uploadedAt: '',
                            artistId: t.artistId,
                            albumId: t.albumId,
                            trackNumber: t.trackNumber,
                            isExplicit: t.isExplicit,
                        })
                    }
                    className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:opacity-90 disabled:opacity-50"
                >
                    {ready ? '▶ Играть' : 'Обрабатывается…'}
                </button>

                <button
                    onClick={() => like.mutate()}
                    disabled={like.isPending}
                    className={`rounded-md border px-4 py-2 transition-colors disabled:opacity-50 ${t.isLikedByMe
                        ? 'border-accent/60 bg-accent/10 text-accent hover:bg-accent/20'
                        : 'border-border hover:bg-bg-elevated'
                        }`}>
                    {t.isLikedByMe ? '♥ В избранном' : '♥ В избранное'}
                </button>

                <button
                    onClick={() => offline.cached ? offline.remove() : offline.add()}
                    disabled={offline.busy || !ready}
                    title={offline.cached ? 'Убрать из офлайн' : 'Скачать для офлайн-проигрывания'}
                    className={`rounded-md border px-4 py-2 transition-colors disabled:opacity-50 ${offline.cached
                            ? 'border-accent/60 bg-accent/10 text-accent hover:bg-accent/20'
                            : 'border-border hover:bg-bg-elevated'
                        }`}
                >
                    {offline.busy
                        ? `⬇ ${offline.progress?.completed ?? 0}/${offline.progress?.total ?? 0}`
                        : offline.cached ? '✓ Офлайн' : '⬇ Офлайн'}
                </button>

                {isOwner ? (
                    <>
                        <button
                            onClick={() => setEditOpen(true)}
                            className="rounded-md border border-border px-4 py-2 hover:bg-bg-elevated">
                            Редактировать
                        </button>
                        <button
                            onClick={() => {
                                if (confirm('Удалить трек безвозвратно?')) remove.mutate();
                            }}
                            disabled={remove.isPending}
                            className="rounded-md border border-danger/40 px-4 py-2 text-danger hover:bg-danger/10 disabled:opacity-50">
                            Удалить
                        </button>
                    </>
                ) : (
                    <>
                        <button
                            onClick={() => dislike.mutate()}
                            disabled={dislike.isPending || dislike.isSuccess}
                            title="Не интересно — убрать из рекомендаций"
                            className={`rounded-md border px-4 py-2 text-sm transition-colors disabled:opacity-50 ${dislike.isSuccess
                                ? 'border-border text-fg-muted line-through'
                                : 'border-border hover:border-danger/40 hover:text-danger'
                                }`}>
                            🚫 Не интересно
                        </button>
                        <ReportButton targetType="Track" targetId={t.id} />
                    </>
                )}
            </div>

            {!ready && (
                <p className="text-sm text-fg-muted">
                    Идёт обработка (LUFS / waveform / HLS-транскод). Эта страница автоматически обновится,
                    когда трек станет Ready.
                </p>
            )}

            {ready && id && (
                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">Оценка</h2>
                    <StarRating trackId={id} />
                </section>
            )}

            {ready && id && <Reviews trackId={id} />}

            {similarQ.data && similarQ.data.length > 0 && (
                <section className="space-y-3">
                    <h2 className="text-xl font-semibold">Похожие</h2>
                    <ul className="divide-y divide-border rounded-md border border-border">
                        {similarQ.data.map((s) => (
                            <TrackRow key={s.id} track={s} />
                        ))}
                    </ul>
                </section>
            )}

            {isOwner && (
                <TrackEditDialog
                    open={editOpen}
                    track={t}
                    onClose={() => setEditOpen(false)}
                />
            )}
        </article>
    );
}