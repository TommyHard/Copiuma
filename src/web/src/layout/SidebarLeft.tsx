import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFollowedUsers, listFollowedArtists, unfollowArtist, unfollowUser } from '@/shared/api/follows';
import { batchUsers } from '@/shared/api/users';
import { listFavorites } from '@/shared/api/tracks';
import { listPlaylists } from '@/shared/api/playlists';
import { getArtist } from '@/shared/api/artists';
import { getPublicUserProfile } from '@/shared/api/profile';
import { useContextMenu, ContextMenuPortal, ContextMenuItem } from '@/shared/ui/ContextMenu';
import { PlaylistCover } from '@/features/playlists/PlaylistCover';
import { CreatePlaylistDialog } from '@/features/playlists/CreatePlaylistDialog';
import { NowPlayingFromBadge } from '@/features/player/NowPlayingBadge';
import { HeartIcon, TrashIcon, SidebarLeftIcon, PlusIcon, SearchIcon, MusicIcon, DjRoomsIcon, OfflineIcon, HistoryIcon } from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
import { cn } from '@/shared/lib/cn';
import type { FollowedUser, FollowedArtist, PlaylistSummary } from '@/shared/types';
import { useUIStore } from '@/shared/store/uiStore';

const scrollbarClasses = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-fg-muted/50";

export function SidebarLeft() {
    const { isLeftOpen, setLeftOpen, leftWidth, isResizingLeft } = useUIStore();
    const [createOpen, setCreateOpen] = useState(false);

    const favoritesQ = useQuery({ queryKey: ['favorites'], queryFn: listFavorites });
    const followingQ = useQuery({ queryKey: ['following-users'], queryFn: getFollowedUsers });
    const followedArtistsQ = useQuery({ queryKey: ['followed-artists'], queryFn: listFollowedArtists });
    const playlistsQ = useQuery({ queryKey: ['playlists'], queryFn: listPlaylists });

    const userIds = (followingQ.data ?? []).map((u) => u.userId);
    const namesQ = useQuery({
        queryKey: ['user-names', ...userIds.sort()],
        queryFn: () => batchUsers(userIds),
        enabled: userIds.length > 0,
        staleTime: 5 * 60 * 1000,
    });
    const nameMap: Record<string, string> = {};
    for (const u of namesQ.data ?? []) nameMap[u.id] = u.displayName;

    return (
        <section
            className={cn(
                "relative flex flex-col shrink-0 rounded-xl bg-bg-elevated border border-border shadow-sm overflow-hidden",
                !isResizingLeft && "transition-[width,min-width,max-width] duration-300 ease-in-out"
            )}
            style={{
                width: isLeftOpen ? leftWidth : '60px',
                minWidth: isLeftOpen ? '200px' : '60px',
                maxWidth: isLeftOpen ? '20vw' : '60px'
            }}
        >
            <div className="flex items-center justify-between px-4 pt-5 pb-2 min-w-0">
                <Tooltip content={isLeftOpen ? "Свернуть" : "Развернуть"} position="right">
                    <button
                        onClick={() => setLeftOpen(!isLeftOpen)}
                        className="flex items-center gap-3 text-fg-muted hover:text-fg transition-colors min-w-0"
                    >
                        <SidebarLeftIcon className={cn("shrink-0 transition-transform", !isLeftOpen && "rotate-180")} />
                        {isLeftOpen && <span className="font-bold text-[13px] uppercase tracking-wider truncate">Медиатека</span>}
                    </button>
                </Tooltip>

                {isLeftOpen && (
                    <Tooltip content="Создать плейлист" position="bottom">
                        <button
                            onClick={() => setCreateOpen(true)}
                            className="flex items-center gap-1.5 px-2 py-1 shrink-0 rounded hover:bg-accent/20 text-fg-muted hover:text-fg transition-colors ml-2"
                        >
                            <PlusIcon className="w-4 h-4" />
                            <span className="text-xs font-medium whitespace-nowrap">Создать</span>
                        </button>
                    </Tooltip>
                )}
            </div>

            <div className={cn(
                "flex-1 overflow-y-auto p-5 pt-2 transition-opacity duration-300",
                scrollbarClasses,
                !isLeftOpen && "px-2"
            )}>
                {/* ИЗБРАННОЕ */}
                <Link to="/favorites" className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-accent/10 transition-colors group">
                    <div className="w-10 h-10 shrink-0 rounded bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-105">
                        <HeartIcon filled={true} className="text-white w-5 h-5" />
                    </div>
                    {isLeftOpen && (
                        <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[15px] font-semibold text-fg tracking-tight truncate group-hover:text-accent transition-colors">Избранное</span>
                            <span className="text-[12px] text-fg-muted truncate">
                                {favoritesQ.data?.length ?? 0} {pluralTracks(favoritesQ.data?.length ?? 0)}
                            </span>
                        </div>
                    )}
                    <NowPlayingFromBadge target={{ type: 'favorites' }} className="shrink-0" />
                </Link>

                {/* DJ-КОМНАТЫ */}
                <Link to="/rooms" className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-accent/10 transition-colors group">
                    <div className="w-10 h-10 shrink-0 rounded bg-gradient-to-br from-fuchsia-500 to-rose-500 flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-105">
                        <DjRoomsIcon className="text-white w-5 h-5" />
                    </div>
                    {isLeftOpen && (
                        <div className="flex flex-col min-w-0">
                            <span className="text-[15px] font-semibold text-fg tracking-tight truncate group-hover:text-accent transition-colors">DJ-комнаты</span>
                            <span className="text-[12px] text-fg-muted truncate">
                                Совместное прослушивание
                            </span>
                        </div>
                    )}
                </Link>

                {/* ОФЛАЙН */}
                <Link to="/offline" className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-accent/10 transition-colors group">
                    <div className="w-10 h-10 shrink-0 rounded bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-105">
                        <OfflineIcon className="text-white w-5 h-5" />
                    </div>
                    {isLeftOpen && (
                        <div className="flex flex-col min-w-0">
                            <span className="text-[15px] font-semibold text-fg tracking-tight truncate group-hover:text-accent transition-colors">Офлайн</span>
                            <span className="text-[12px] text-fg-muted truncate">
                                Скачанные треки
                            </span>
                        </div>
                    )}
                </Link>

                {/* ИСТОРИЯ */}
                <Link to="/history" className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-accent/10 transition-colors group">
                    <div className="w-10 h-10 shrink-0 rounded bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-105">
                        <HistoryIcon className="text-white w-5 h-5" />
                    </div>
                    {isLeftOpen && (
                        <div className="flex flex-col min-w-0">
                            <span className="text-[15px] font-semibold text-fg tracking-tight truncate group-hover:text-accent transition-colors">История</span>
                            <span className="text-[12px] text-fg-muted truncate">
                                Недавно прослушанное
                            </span>
                        </div>
                    )}
                </Link>

                {/* SEPARATOR */}
                {isLeftOpen && <div className="h-px bg-border my-4 -mx-2" />}

                {/* FRIENDS */}
                {followingQ.data?.map(u => (
                    <FriendSidebarItem key={u.userId} user={u} nameMap={nameMap} compact={!isLeftOpen} />
                ))}

                {/* ARTISTS */}
                {followedArtistsQ.data?.map(a => (
                    <ArtistSidebarItem key={a.artistId} artist={a} compact={!isLeftOpen} />
                ))}

                {/* SEPARATOR */}
                {isLeftOpen && <div className="h-px bg-border my-4 -mx-2" />}

                {/* PUBLIC PLAYLIST'S */}
                <div className="space-y-1">
                    <Link to="/playlists" className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-accent/10 transition-colors group">
                        <div className="w-10 h-10 shrink-0 rounded-md bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-105">
                            <SearchIcon className="w-5 h-5 text-white" />
                        </div>
                        {isLeftOpen && (
                            <div className="flex flex-col min-w-0">
                                <span className="text-[15px] font-semibold text-fg tracking-tight truncate group-hover:text-accent group-hover:underline transition-colors">Публичные</span>
                                <span className="text-[11px] text-fg-muted uppercase tracking-wider">Поиск плейлистов</span>
                            </div>
                        )}
                    </Link>

                    {playlistsQ.data?.map(p => (
                        <PlaylistSidebarItem key={p.id} playlist={p} compact={!isLeftOpen} />
                    ))}
                </div>
            </div>

            <CreatePlaylistDialog open={createOpen} onClose={() => setCreateOpen(false)} />
        </section>
    );
}

function PlaylistSidebarItem({ playlist, compact }: { playlist: PlaylistSummary, compact: boolean }) {

    const hasCover = !!playlist.coverUrl || (playlist.previewCovers && playlist.previewCovers.length > 0);

    return (
        <Link to={`/playlists/${playlist.id}`} className="flex items-center gap-3 mb-1 p-2 -mx-2 rounded-lg hover:bg-accent/10 transition-colors group">
            <div className="w-10 h-10 shrink-0 transition-transform duration-300 group-hover:scale-105 shadow-md rounded-md overflow-hidden bg-bg-elevated flex items-center justify-center tracking-tight">
                {hasCover ? (
                    <PlaylistCover coverUrl={playlist.coverUrl} previewCovers={playlist.previewCovers} className="w-full h-full" rounded="md" />
                ) : (
                    <MusicIcon className="w-6 h-6 opacity-40" />
                )}
            </div>
            {!compact && (
                <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[15px] font-semibold text-fg tracking-tight truncate group-hover:text-accent group-hover:underline transition-colors">{playlist.title}</span>
                    <span className="text-[12px] text-fg-muted truncate">Плейлист • {playlist.ownerName || 'Автор'}</span>
                </div>
            )}
            <NowPlayingFromBadge target={{ type: 'playlist', id: playlist.id }} className="shrink-0" />
        </Link>
    );
}

function FriendSidebarItem({ user, nameMap, compact }: { user: FollowedUser; nameMap: Record<string, string>, compact: boolean }) {
    const qc = useQueryClient();
    const contextMenu = useContextMenu();
    const name = nameMap[user.userId] ?? user.userId.slice(0, 8);
    const profileQ = useQuery({ queryKey: ['user-profile', user.userId], queryFn: () => getPublicUserProfile(user.userId), staleTime: 5 * 60 * 1000 });
    const avatarUrl = profileQ.data?.avatarUrl;
    const unfollow = useMutation({ mutationFn: () => unfollowUser(user.userId), onSuccess: () => qc.invalidateQueries({ queryKey: ['following-users'] }) });

    return (
        <>
            <Link to={`/users/${user.userId}`} onContextMenu={contextMenu.onContextMenu} className="flex items-center gap-3 mb-1 p-2 -mx-2 rounded-lg hover:bg-accent/10 transition-colors group">
                <div className="w-10 h-10 shrink-0 rounded-full bg-bg-elevated bg-cover bg-center flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-105 text-lg font-bold text-fg-muted" style={{ backgroundImage: avatarUrl ? `url('${avatarUrl}')` : undefined }}>{!avatarUrl && name.charAt(0).toUpperCase()}</div>
                {!compact && <div className="flex flex-col min-w-0">
                    <span className="text-[15px] font-semibold text-fg tracking-tight truncate group-hover:text-accent group-hover:underline transition-colors">{name}</span>
                    <span className="text-[12px] text-fg-muted truncate">Друг • {new Date(user.subscribedAt).toLocaleDateString('ru-RU')}</span>
                </div>}
            </Link>
            <ContextMenuPortal isOpen={contextMenu.isOpen} position={contextMenu.position}>
                <ContextMenuItem danger icon={<TrashIcon className="w-4 h-4" />} onClick={() => { unfollow.mutate(); contextMenu.close(); }}>Отписаться</ContextMenuItem>
            </ContextMenuPortal>
        </>
    );
}

function ArtistSidebarItem({ artist, compact }: { artist: FollowedArtist, compact: boolean }) {
    const qc = useQueryClient();
    const contextMenu = useContextMenu();
    const artistQ = useQuery({ queryKey: ['artist', artist.artistId], queryFn: () => getArtist(artist.artistId), staleTime: 5 * 60 * 1000 });
    const avatarUrl = artistQ.data?.avatarUrl;
    const unfollow = useMutation({ mutationFn: () => unfollowArtist(artist.artistId), onSuccess: () => qc.invalidateQueries({ queryKey: ['followed-artists'] }) });

    return (
        <>
            <Link to={`/artists/${artist.artistId}`} onContextMenu={contextMenu.onContextMenu} className="flex items-center gap-3 mb-1 p-2 -mx-2 rounded-lg hover:bg-accent/10 transition-colors group">
                <div className="w-10 h-10 shrink-0 rounded-full bg-bg-elevated bg-cover bg-center flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-105 text-lg font-bold text-fg-muted" style={{ backgroundImage: avatarUrl ? `url('${avatarUrl}')` : undefined }}>{!avatarUrl && artist.name ? artist.name.charAt(0).toUpperCase() : null}</div>
                {!compact && <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-[15px] font-semibold text-fg tracking-tight truncate group-hover:text-accent group-hover:underline transition-colors">{artist.name}</span>
                    <span className="text-[12px] text-fg-muted truncate">Артист • {new Date(artist.followedAt).toLocaleDateString('ru-RU')}</span>
                </div>}
                <NowPlayingFromBadge target={{ type: 'artist', id: artist.artistId }} className="shrink-0" />
            </Link>
            <ContextMenuPortal isOpen={contextMenu.isOpen} position={contextMenu.position}>
                <ContextMenuItem danger icon={<TrashIcon className="w-4 h-4" />} onClick={() => { unfollow.mutate(); contextMenu.close(); }}>Отписаться</ContextMenuItem>
            </ContextMenuPortal>
        </>
    );
}

function pluralTracks(n: number): string {
    const last2 = n % 100; const last1 = n % 10;
    if (last2 >= 11 && last2 <= 14) return 'треков';
    if (last1 === 1) return 'трек';
    if (last1 >= 2 && last1 <= 4) return 'трека';
    return 'треков';
}