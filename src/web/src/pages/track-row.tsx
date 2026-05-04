import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TrackListItem } from '@/shared/types';
import { usePlayTrack } from '@/features/player/usePlayTrack';
import { AddToPlaylistMenu } from '@/features/playlists/AddToPlaylistMenu';
import { useToggleTrackLike } from '@/features/track/useToggleTrackLike';
import { dislikeTrack, undoDislikeTrack } from '@/shared/api/dislikes';
import { cn } from '@/shared/lib/cn';

export function TrackRow({ track, number }: { track: TrackListItem; number?: number }) {
    const play = usePlayTrack();
    const qc = useQueryClient();
    const like = useToggleTrackLike();
    const liked = !!track.isLikedByMe;

    const [isDisliked, setIsDisliked] = useState(track.isDislikedByMe ?? false);

    // Мутация теперь работает как переключатель (toggle)
    const toggleDislike = useMutation({
        mutationFn: () => isDisliked ? undoDislikeTrack(track.id) : dislikeTrack(track.id),
        onSuccess: () => {
            setIsDisliked(!isDisliked);
            // Обновление ленты в фоне
            qc.invalidateQueries({ queryKey: ['recommendations'] });
            qc.invalidateQueries({ queryKey: ['catalog'] });
            qc.invalidateQueries({ queryKey: ['for-you'] });
            qc.invalidateQueries({ queryKey: ['artist-tracks'] });
        },
    });

    return (
        <li className={cn(
            "flex items-center gap-3 px-4 py-3 hover:bg-bg-elevated/50 transition-all",
            // Desaturate, если трек дизлайкнут
            isDisliked && "opacity-50 grayscale"
        )}>
            {/* Кнопка Play */}
            <button
                onClick={() => play(track)}
                disabled={isDisliked}
                className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg hover:opacity-90 transition-opacity",
                    isDisliked && "cursor-not-allowed opacity-40"
                )}
                title={isDisliked ? "Трек скрыт" : "Играть"}
            >
                <svg className="size-4 ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                </svg>
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
                <div className="truncate text-xs text-fg-muted">
                    {track.artistId ? (
                        <Link
                            to={`/artists/${track.artistId}`}
                            className="hover:text-fg hover:underline"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {track.artist ?? 'Неизвестен'}
                        </Link>
                    ) : (
                        <span>{track.artist ?? 'Неизвестен'}</span>
                    )}

                    {/* feat. */}
                    {track.featuredArtists && track.featuredArtists.length > 0 && (
                        <span>
                            {' '}feat.{' '}
                            {track.featuredArtists.map((fa, idx) => (
                                <span key={fa.id}>
                                    {idx > 0 && ', '}
                                    <Link
                                        to={`/artists/${fa.id}`}
                                        className="hover:text-fg hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {fa.name}
                                    </Link>
                                </span>
                            ))}
                        </span>
                    )}
                </div>
            </div>

            <span className="text-xs tabular-nums text-fg-muted">{formatDuration(track.duration)}</span>

            <button
                onClick={() => like.mutate({ trackId: track.id, nextLiked: !liked })}
                disabled={like.isPending}
                className={cn(
                    "text-lg transition-colors hover:scale-110 disabled:opacity-50",
                    liked ? "text-accent" : "text-fg-muted hover:text-fg"
                )}
                title={liked ? "Убрать из избранного" : "В избранное"}
            >
                ♥
            </button>

            <AddToPlaylistMenu trackId={track.id} />

            {/* Dislike */}
            <button
                onClick={() => toggleDislike.mutate()}
                disabled={toggleDislike.isPending}
                title={isDisliked ? "Вернуть в рекомендации" : "Не интересно"}
                className={cn(
                    "text-sm transition-colors disabled:opacity-40",
                    isDisliked
                        ? "text-danger"
                        : "text-fg-muted hover:text-danger"
                )}
            >
                🚫
            </button>
        </li>
    );
}

function formatDuration(d: string | null): string {
    if (!d) return '--:--';
    const m = /^(?:\d+\.)?(\d{2}):(\d{2}):(\d{2})/.exec(d);
    if (!m) return d;
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ss = parseInt(m[3], 10);
    if (h > 0) return `${h}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    return `${mm}:${ss.toString().padStart(2, '0')}`;
}