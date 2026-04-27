import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { getTrack, getTrackStatus } from '@/shared/api/catalog';
import { toggleLike } from '@/shared/api/tracks';
import { usePlayTrack } from '@/features/player/usePlayTrack';

export function TrackPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const play = usePlayTrack();

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

  const like = useMutation({
    mutationFn: () => toggleLike(id!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] }),
  });

  if (trackQ.isLoading) return <p className="text-fg-muted">Загружаем…</p>;
  if (trackQ.isError || !trackQ.data) return <p className="text-danger">Трек не найден.</p>;

  const t = trackQ.data;
  const ready = statusQ.data?.status === 'Ready';

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">{t.title}</h1>
        <p className="text-fg-muted">{t.artist ?? '—'}</p>
        {t.isExplicit && (
          <span className="rounded bg-fg/15 px-2 py-0.5 text-xs uppercase text-fg-muted">explicit</span>
        )}
      </header>

      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-fg-muted">Длительность</dt>
        <dd>{t.duration ?? '—'}</dd>

        <dt className="text-fg-muted">Статус анализа</dt>
        <dd>{statusQ.data?.status ?? '...'}</dd>

        {t.albumId && (
          <>
            <dt className="text-fg-muted">Альбом</dt>
            <dd>#{t.trackNumber ?? '—'} в альбоме {t.albumId}</dd>
          </>
        )}
      </dl>

      <div className="flex flex-wrap gap-3">
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
          className="rounded-md bg-accent px-4 py-2 text-accent-fg hover:opacity-90 disabled:opacity-50"
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
      </div>

      {!ready && (
        <p className="text-sm text-fg-muted">
          Этот трек ещё проходит обработку (LUFS / waveform / HLS-транскод). Страница автоматически
          обновится, когда станет «Ready».
        </p>
      )}
    </article>
  );
}