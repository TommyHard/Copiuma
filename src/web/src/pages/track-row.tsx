import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TrackListItem } from '@/shared/types';
import { usePlayTrack } from '@/features/player/usePlayTrack';
import { AddToPlaylistMenu } from '@/features/playlists/AddToPlaylistMenu';
import { toggleLike } from '@/shared/api/tracks';
import { dislikeTrack } from '@/shared/api/dislikes';
import { cn } from '@/shared/lib/cn';

export function TrackRow({ track, number }: { track: TrackListItem; number?: number }) {
    const play = usePlayTrack();
    const qc = useQueryClient();

    const [optimisticLiked, setOptimisticLiked] = useState(track.isLikedByMe ?? false);

    useEffect(() => {
        setOptimisticLiked(track.isLikedByMe ?? false);
    }, [track.isLikedByMe]);

    const like = useMutation({
        mutationFn: () => toggleLike(track.id),
        onMutate: () => {
            setOptimisticLiked((prev) => !prev);
        },
        onError: () => {
            setOptimisticLiked((prev) => !prev);
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ['catalog'] });
            qc.invalidateQueries({ queryKey: ['favorites'] });
            qc.invalidateQueries({ queryKey: ['popular'] });
            qc.invalidateQueries({ queryKey: ['for-you'] });
            qc.invalidateQueries({ queryKey: ['track', track.id] });
            qc.invalidateQueries({ queryKey: ['similar'] });
        },
    });

    const dislike = useMutation({
        mutationFn: () => dislikeTrack(track.id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['recommendations'] });
            qc.invalidateQueries({ queryKey: ['catalog'] });
        },
    });

    return (
        <li className="flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated/50">
            <button
                onClick={() => play(track)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg hover:opacity-90"
                title="Играть">
                ▶
            </button>

            {number !== undefined && (
                <span className="hidden w-6 text-right text-xs tabular-nums text-fg-muted md:inline-block">
                    {number}
                </span>
            )}

            <div className="min-w-0 flex-1">
                <Link to={`/tracks/${track.id}`} className="block truncate font-medium hover:underline">
                    {track.title}
                    {track.isExplicit && (
                        <span className="ml-2 rounded bg-fg/15 px-1.5 py-0.5 text-[10px] uppercase text-fg-muted">
                            E
                        </span>
                    )}
                </Link>
                {track.artistId ? (
                    <Link
                        to={`/artists/${track.artistId}`}
                        className="block truncate text-xs text-fg-muted hover:text-fg hover:underline"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {track.artist ?? '—'}
                    </Link>
                ) : (
                    <div className="truncate text-xs text-fg-muted">{track.artist ?? '—'}</div>
                )}
            </div>

            <span className="text-xs tabular-nums text-fg-muted">{formatDuration(track.duration)}</span>

            <button
                onClick={() => like.mutate()}
                disabled={like.isPending}
                className={cn(
                    "text-lg transition-colors hover:scale-110 disabled:opacity-50",
                    optimisticLiked ? "text-accent" : "text-fg-muted hover:text-fg"
                )}
                title={optimisticLiked ? "Убрать из избранного" : "В избранное"}>
                ♥
            </button>

            <AddToPlaylistMenu trackId={track.id} />

            <button
                onClick={() => dislike.mutate()}
                disabled={dislike.isPending || dislike.isSuccess}
                title="Не интересно — убрать из рекомендаций"
                className={cn(
                    "text-sm transition-colors disabled:opacity-40",
                    dislike.isSuccess
                        ? "text-fg-muted line-through"
                        : "text-fg-muted hover:text-danger"
                )}
            >
                🚫
            </button>
        </li>
    );
}

function formatDuration(d: string | null): string {
    if (!d) return '—';
    const m = /^(?:\d+\.)?(\d{2}):(\d{2}):(\d{2})/.exec(d);
    if (!m) return d;
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ss = parseInt(m[3], 10);
    if (h > 0) return `${h}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    return `${mm}:${ss.toString().padStart(2, '0')}`;
}