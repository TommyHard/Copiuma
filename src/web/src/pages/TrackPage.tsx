import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTrack, getTrackStatus } from '@/shared/api/catalog';
import { deleteTrack, toggleLike } from '@/shared/api/tracks';
import { similarTracks } from '@/shared/api/recommendations';
import { usePlayTrack } from '@/features/player/usePlayTrack';
import { Waveform } from '@/features/track/Waveform';
import { TrackRow } from './track-row';
import { useAuth } from '@/features/auth/useAuth';
import { StarRating } from '@/features/ratings/StarRating';
import { Reviews } from '@/features/reviews/Reviews';
import { ReportButton } from '@/features/reports/ReportButton';

export function TrackPage() {
    const { id } = useParams();
    const qc = useQueryClient();
    const navigate = useNavigate();
    const play = usePlayTrack();
    const { user } = useAuth();

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

    const like = useMutation({
        mutationFn: () => toggleLike(id!),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
    });

    const remove = useMutation({
        mutationFn: () => deleteTrack(id!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['catalog'] });
            qc.invalidateQueries({ queryKey: ['favorites'] });
            navigate('/catalog');
        },
    });

    if (trackQ.isLoading) return <p className="text-fg-muted">Загружаем…</p>;
    if (trackQ.isError || !trackQ.data) return <p className="text-danger">Трек не найден.</p>;

    const t = trackQ.data;
    const ready = statusQ.data?.status === 'Ready';
    const isOwner = !!user && !!t.uploadedByUserId && user.id === t.uploadedByUserId;

    return (
        <article className="space-y-10">
            <header className="space-y-2">
                <h1 className="text-3xl font-semibold">{t.title}</h1>
                <div className="flex items-baseline gap-3">
                    {t.artistId ? (
                        <Link to={`/artists/${t.artistId}`} className="text-fg-muted hover:text-fg">
                            {t.artist ?? '—'}
                        </Link>
                    ) : (
                        <p className="text-fg-muted">{t.artist ?? '—'}</p>
                    )}
                    {t.albumId && (
                        <>
                            <span className="text-fg-muted">·</span>
                            <Link to={`/albums/${t.albumId}`} className="text-fg-muted hover:text-fg">
                                альбом{t.trackNumber ? ` #${t.trackNumber}` : ''}
                            </Link>
                        </>
                    )}
                    {t.isExplicit && (
                        <span className="rounded bg-fg/15 px-1.5 py-0.5 text-[10px] uppercase text-fg-muted">
                            explicit
                        </span>
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
                    className="rounded-md border border-border px-4 py-2 hover:bg-bg-elevated disabled:opacity-50"
                >
                    ♥ В избранное
                </button>

                {isOwner ? (
                    <button
                        onClick={() => {
                            if (confirm('Удалить трек безвозвратно?')) remove.mutate();
                        }}
                        disabled={remove.isPending}
                        className="rounded-md border border-danger/40 px-4 py-2 text-danger hover:bg-danger/10 disabled:opacity-50"
                    >
                        Удалить
                    </button>
                ) : (
                    <ReportButton targetType="Track" targetId={t.id} />
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
        </article>
    );
}