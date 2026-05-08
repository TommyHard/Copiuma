import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TrackListItem } from '@/shared/types';
import { usePlayTrack } from '@/features/player/usePlayTrack';
import { usePlayer } from '@/features/player/store';
import { useToggleTrackLike } from '@/features/track/useToggleTrackLike';
import { dislikeTrack, undoDislikeTrack } from '@/shared/api/dislikes';
import { addTrack, listPlaylists, getPlaylistsContainingTrack } from '@/shared/api/playlists';
import { Tooltip } from '@/shared/ui/Tooltip';
import { useContextMenu, ContextMenuPortal, ContextMenuItem, ContextMenuSub, ContextMenuSeparator } from '@/shared/ui/ContextMenu';
import { PlayIcon, HeartIcon, PlusIcon, DislikeIcon, SearchIcon, TrashIcon, CheckIcon } from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';

export function TrackRow({ track, number, onPlay, onRemoveFromQueue }: { track: TrackListItem; number?: number; onPlay?: () => void; onRemoveFromQueue?: () => void; }) {
    const play = usePlayTrack();
    const qc = useQueryClient();
    const like = useToggleTrackLike();
    const updatePlayerTrack = usePlayer(s => s.updateTrackState);
    const liked = !!track.isLikedByMe;

    const [isDisliked, setIsDisliked] = useState(track.isDislikedByMe ?? false);
    const contextMenu = useContextMenu();

    const [playlistSearch, setPlaylistSearch] = useState('');

    useEffect(() => {
        if (!contextMenu.isOpen) setPlaylistSearch('');
    }, [contextMenu.isOpen]);

    const toggleDislike = useMutation({
        mutationFn: () => isDisliked ? undoDislikeTrack(track.id) : dislikeTrack(track.id),
        onSuccess: () => {
            setIsDisliked(!isDisliked);
            qc.invalidateQueries({ queryKey: ['recommendations'] });
            qc.invalidateQueries({ queryKey: ['catalog'] });
            qc.invalidateQueries({ queryKey: ['for-you'] });
            qc.invalidateQueries({ queryKey: ['artist-tracks'] });
        },
    });

    const qPlaylists = useQuery({
        queryKey: ['playlists'],
        queryFn: listPlaylists,
        enabled: contextMenu.isOpen,
        staleTime: 60_000,
    });

    const qContaining = useQuery({
        queryKey: ['playlists-containing', track.id],
        queryFn: () => getPlaylistsContainingTrack(track.id),
        enabled: contextMenu.isOpen,
        staleTime: 30_000,
    });
    const containingSet = new Set(qContaining.data ?? []);

    const addTrackToPlaylist = useMutation({
        mutationFn: (playlistId: string) => addTrack(playlistId, track.id),
        onSuccess: (_, playlistId) => {
            qc.invalidateQueries({ queryKey: ['playlist', playlistId] });
            qc.invalidateQueries({ queryKey: ['playlists-containing', track.id] });
            contextMenu.close();
        },
    });

    const filteredPlaylists = qPlaylists.data?.filter(p =>
        p.title.toLowerCase().includes(playlistSearch.toLowerCase())
    ) || [];

    return (
        <>
            <li
                onContextMenu={contextMenu.onContextMenu}
                className={cn(
                    "flex items-center gap-3 px-3 py-2 hover:bg-fg/5 transition-colors rounded-md cursor-default select-none",
                    isDisliked && "opacity-40 grayscale"
                )}
            >
                <Tooltip position="top" content={isDisliked ? "Трек скрыт" : "Играть"}>
                    <button
                        onClick={() => onPlay ? onPlay() : play(track)}
                        disabled={isDisliked}
                        className="relative flex items-center justify-center size-8 shrink-0 text-fg-muted hover:text-fg transition-colors disabled:opacity-50"
                    >
                        <PlayIcon className="size-4" />
                    </button>
                </Tooltip>

                {number !== undefined && (
                    <span className="hidden w-5 text-right text-xs tabular-nums text-fg-muted md:inline-block">
                        {number}
                    </span>
                )}

                <div className="size-10 bg-bg-elevated rounded flex items-center justify-center overflow-hidden shrink-0 shadow-sm ml-1">
                    {track.coverUrl ? (
                        <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-xs text-fg-muted">♪</span>
                    )}
                </div>

                <div className="flex flex-col min-w-0 flex-1 ml-2 justify-center">
                    <Link to={`/tracks/${track.id}`} className="block truncate font-semibold text-sm hover:underline text-fg">
                        {track.title}
                        {track.isExplicit && (
                            <span className="ml-2 rounded bg-fg/15 px-1.5 py-0.5 text-[9px] uppercase text-fg-muted align-middle">
                                E
                            </span>
                        )}
                    </Link>

                    <div className="truncate text-xs text-fg-muted mt-0.5">
                        {track.artistId ? (
                            <Link to={`/artists/${track.artistId}`} className="hover:text-fg hover:underline" onClick={(e) => e.stopPropagation()}>
                                {track.artist ?? 'Неизвестен'}
                            </Link>
                        ) : (
                            <span>{track.artist ?? 'Неизвестен'}</span>
                        )}

                        {track.featuredArtists && track.featuredArtists.length > 0 && (
                            <span>
                                {', feat. '}
                                {track.featuredArtists.map((fa, idx) => (
                                    <span key={fa.id}>
                                        {idx > 0 && ', '}
                                        <Link to={`/artists/${fa.id}`} className="hover:text-fg hover:underline" onClick={(e) => e.stopPropagation()}>
                                            {fa.name}
                                        </Link>
                                    </span>
                                ))}
                            </span>
                        )}
                    </div>
                </div>

                <Tooltip position="top" content={liked ? "Убрать из избранного" : "В избранное"}>
                    <button
                        onClick={() => {
                            like.mutate({ trackId: track.id, nextLiked: !liked });
                            updatePlayerTrack?.(track.id, { isLikedByMe: !liked });
                        }}
                        disabled={like.isPending}
                        className={cn(
                            "relative transition-transform hover:scale-110 disabled:opacity-50 shrink-0",
                            liked ? "text-accent" : "text-fg-muted hover:text-fg"
                        )}
                    >
                        <HeartIcon filled={liked} />
                    </button>
                </Tooltip>

                <span className="text-xs tabular-nums text-fg-muted ml-3 w-10 text-right shrink-0">
                    {formatDuration(track.duration)}
                </span>
            </li>

            <ContextMenuPortal isOpen={contextMenu.isOpen} position={contextMenu.position}>
                <ContextMenuSub label="Добавить в плейлист" icon={<PlusIcon />}>
                    <div className="px-2 py-1.5">
                        <div className="relative">
                            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-muted" />
                            <input
                                type="text"
                                placeholder="Найти плейлист"
                                value={playlistSearch}
                                onChange={(e) => setPlaylistSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                                className="w-full bg-bg border border-border rounded-md pl-8 pr-3 py-1 text-xs text-fg focus:outline-none focus:border-accent transition-colors"
                            />
                        </div>
                    </div>

                    <ContextMenuSeparator />

                    <div className="max-h-[200px] overflow-y-auto">
                        {qPlaylists.isLoading && <p className="px-3 py-2 text-xs text-fg-muted">Загрузка...</p>}

                        {qPlaylists.data && filteredPlaylists.length === 0 && (
                            <p className="px-3 py-2 text-xs text-fg-muted">Ничего не найдено</p>
                        )}

                        {filteredPlaylists.map((p) => {
                            const already = containingSet.has(p.id);
                            return (
                                <ContextMenuItem
                                    key={p.id}
                                    disabled={addTrackToPlaylist.isPending || already}
                                    onClick={() => !already && addTrackToPlaylist.mutate(p.id)}
                                    icon={already ? <CheckIcon className="w-3.5 h-3.5 text-accent" /> : undefined}
                                >
                                    {already ? `${p.title} • уже добавлен` : p.title}
                                </ContextMenuItem>
                            );
                        })}
                    </div>
                </ContextMenuSub>

                {onRemoveFromQueue && (
                    <>
                        <ContextMenuItem
                            icon={<TrashIcon />}
                            onClick={() => {
                                onRemoveFromQueue();
                                contextMenu.close();
                            }}
                        >
                            Удалить из очереди
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                    </>
                )}

                <ContextMenuItem
                    danger
                    icon={<DislikeIcon />}
                    onClick={() => {
                        toggleDislike.mutate();
                        contextMenu.close();
                    }}
                >
                    {isDisliked ? "Вернуть в рекомендации" : "Не интересует"}
                </ContextMenuItem>
            </ContextMenuPortal>
        </>
    );
}

function formatDuration(d: string | null): string {
    if (!d) return '-:-';
    const m = /^(?:\d+\.)?(\d{2}):(\d{2}):(\d{2})/.exec(d);
    if (!m) return d;
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ss = parseInt(m[3], 10);
    if (h > 0) return `${h}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    return `${mm}:${ss.toString().padStart(2, '0')}`;
}