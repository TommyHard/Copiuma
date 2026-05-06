import { useState, useCallback, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { getFeed, getFriendsFeed, followArtist, unfollowArtist, listFollowedArtists, getFollowedUsers, unfollowUser } from '@/shared/api/follows';
import { batchUsers } from '@/shared/api/users';
import { forYouTracks, popularTracks, trendingArtists } from '@/shared/api/recommendations';
import { listTracks } from '@/shared/api/catalog';
import { listFavorites } from '@/shared/api/tracks';
import { TrackRow } from './track-row';
import { useUIStore } from '@/shared/store/uiStore';
import { usePlayer } from '@/features/player/store';
import { getTrackStatus } from '@/shared/api/catalog';
import { getArtist } from '@/shared/api/artists';
import { getPublicUserProfile } from '@/shared/api/profile';
import { useContextMenu, ContextMenuPortal, ContextMenuItem } from '@/shared/ui/ContextMenu';
import type { FriendFeedItem, TrackListItem, FollowedUser, FollowedArtist } from '@/shared/types';
import { Tooltip } from '@/shared/ui/Tooltip';
import { SidebarLeftIcon, SidebarRightIcon, UsersIcon, MusicIcon, ArrowRightIcon, QueueIcon, HeartIcon, TrashIcon } from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';

const scrollbarClasses = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-fg-muted/50";

const scrollableListClasses = cn(
    "max-h-[400px] overflow-y-auto overflow-x-hidden rounded-md border border-border",
    scrollbarClasses
);

function ResizeHandle({
    width,
    onWidthChange,
    direction = 1
}: {
    width: number;
    onWidthChange: (newWidth: number) => void;
    direction?: 1 | -1;
}) {
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = width;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - startX;
            onWidthChange(startWidth + deltaX * direction);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'default';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'col-resize';
    }, [width, onWidthChange, direction]);

    return (
        <div
            className="w-2 shrink-0 cursor-pointer bg-clip-content px-[3px] bg-transparent hover:bg-accent/50 active:bg-accent transition-colors"
            onMouseDown={handleMouseDown}
            aria-hidden="true"
        />
    );
}

// === КОМПОНЕНТ ДЛЯ ОТОБРАЖЕНИЯ ДРУГА С КОНТЕКСТНЫМ МЕНЮ И АВАТАРОМ ===
function FriendSidebarItem({ user, nameMap }: { user: FollowedUser; nameMap: Record<string, string> }) {
    const qc = useQueryClient();
    const contextMenu = useContextMenu();
    const name = nameMap[user.userId] ?? user.userId.slice(0, 8);

    // Дополнительно запрашиваем профиль, чтобы получить avatarUrl
    const profileQ = useQuery({
        queryKey: ['user-profile', user.userId],
        queryFn: () => getPublicUserProfile(user.userId),
        staleTime: 5 * 60 * 1000,
    });
    const avatarUrl = profileQ.data?.avatarUrl;

    const unfollow = useMutation({
        mutationFn: () => unfollowUser(user.userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['following-users'] })
    });

    return (
        <>
            <Link
                to={`/users/${user.userId}`}
                onContextMenu={contextMenu.onContextMenu}
                className="flex items-center gap-3 mb-1 p-2 -mx-2 rounded-lg hover:bg-accent/10 transition-colors group"
            >
                <div
                    className="w-14 h-14 shrink-0 rounded-full bg-bg-elevated bg-cover bg-center flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-105 text-xl font-bold text-fg-muted"
                    style={{ backgroundImage: avatarUrl ? `url('${avatarUrl}')` : undefined }}
                >
                    {!avatarUrl && name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[17px] font-semibold text-fg tracking-tight truncate group-hover:text-accent transition-colors">{name}</span>
                    <span className="text-[13px] text-fg-muted truncate">
                        Друг • {new Date(user.subscribedAt).toLocaleDateString('ru-RU')}
                    </span>
                </div>
            </Link>
            <ContextMenuPortal isOpen={contextMenu.isOpen} position={contextMenu.position}>
                <ContextMenuItem
                    danger
                    icon={<TrashIcon className="w-4 h-4" />}
                    onClick={() => {
                        unfollow.mutate();
                        contextMenu.close();
                    }}
                >
                    Отписаться
                </ContextMenuItem>
            </ContextMenuPortal>
        </>
    );
}

// === КОМПОНЕНТ ДЛЯ ОТОБРАЖЕНИЯ АРТИСТА С КОНТЕКСТНЫМ МЕНЮ И АВАТАРОМ ===
function ArtistSidebarItem({ artist }: { artist: FollowedArtist }) {
    const qc = useQueryClient();
    const contextMenu = useContextMenu();

    // Дополнительно запрашиваем артиста, чтобы получить его актуальный avatarUrl
    const artistQ = useQuery({
        queryKey: ['artist', artist.artistId],
        queryFn: () => getArtist(artist.artistId),
        staleTime: 5 * 60 * 1000,
    });
    const avatarUrl = artistQ.data?.avatarUrl;

    const unfollow = useMutation({
        mutationFn: () => unfollowArtist(artist.artistId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['followed-artists'] })
    });

    return (
        <>
            <Link
                to={`/artists/${artist.artistId}`}
                onContextMenu={contextMenu.onContextMenu}
                className="flex items-center gap-3 mb-1 p-2 -mx-2 rounded-lg hover:bg-accent/10 transition-colors group"
            >
                <div
                    className="w-14 h-14 shrink-0 rounded-full bg-bg-elevated bg-cover bg-center flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-105 text-xl font-bold text-fg-muted"
                    style={{ backgroundImage: avatarUrl ? `url('${avatarUrl}')` : undefined }}
                >
                    {!avatarUrl && artist.name ? artist.name.charAt(0).toUpperCase() : null}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-[17px] font-semibold text-fg tracking-tight truncate group-hover:text-accent transition-colors">{artist.name}</span>
                    <span className="text-[13px] text-fg-muted truncate">
                        Артист • {new Date(artist.followedAt).toLocaleDateString('ru-RU')}
                    </span>
                </div>
            </Link>
            <ContextMenuPortal isOpen={contextMenu.isOpen} position={contextMenu.position}>
                <ContextMenuItem
                    danger
                    icon={<TrashIcon className="w-4 h-4" />}
                    onClick={() => {
                        unfollow.mutate();
                        contextMenu.close();
                    }}
                >
                    Отписаться
                </ContextMenuItem>
            </ContextMenuPortal>
        </>
    );
}


export function HomePage() {
    const { user } = useAuth();

    const feed = useQuery({ queryKey: ['feed'], queryFn: () => getFeed(20) });
    const friendsFeed = useQuery({ queryKey: ['friends-feed'], queryFn: () => getFriendsFeed(20) });
    const popular = useQuery({ queryKey: ['popular'], queryFn: () => popularTracks(15) });
    const forYou = useQuery({ queryKey: ['for-you'], queryFn: () => forYouTracks(15) });
    const artists = useQuery({ queryKey: ['trending-artists'], queryFn: () => trendingArtists(8) });
    const favoritesQ = useQuery({ queryKey: ['favorites'], queryFn: listFavorites });

    // Для SECTION 1: подписки
    const followingQ = useQuery({ queryKey: ['following-users'], queryFn: getFollowedUsers });
    const followedArtistsQ = useQuery({ queryKey: ['followed-artists'], queryFn: listFollowedArtists });

    const userIds = (followingQ.data ?? []).map((u) => u.userId);
    const namesQ = useQuery({
        queryKey: ['user-names', ...userIds.sort()],
        queryFn: () => batchUsers(userIds),
        enabled: userIds.length > 0,
        staleTime: 5 * 60 * 1000,
    });
    const nameMap: Record<string, string> = {};
    for (const u of namesQ.data ?? []) nameMap[u.id] = u.displayName;

    const popularEmpty = !popular.isLoading && (!popular.data || popular.data.length === 0);
    const catalog = useQuery({
        queryKey: ['catalog', 1],
        queryFn: () => listTracks(1, 15),
        enabled: popularEmpty,
    });

    const playQueueStore = usePlayer(s => s.playQueue);

    const handlePlayContext = async (list: TrackListItem[], index: number) => {
        const sliced = list.slice(index);

        const playerTracks = sliced.map(t => ({
            id: t.id, title: t.title, artist: t.artist, duration: t.duration,
            uploadedAt: t.uploadedAt, artistId: t.artistId ?? null,
            albumId: t.albumId ?? null, trackNumber: t.trackNumber ?? null,
            isExplicit: t.isExplicit, coverUrl: t.coverUrl,
            isLikedByMe: t.isLikedByMe, featuredArtists: t.featuredArtists,
            hlsReady: true
        }));

        try {
            const st = await getTrackStatus(playerTracks[0].id);
            if (st.status !== 'Ready') {
                alert('Трек обрабатывается. Подождите...');
                return;
            }
            playQueueStore(playerTracks as any, 0);
        } catch (e) {
            console.error("Ошибка проверки статуса трека");
        }
    };

    const feedTracks = feed.data?.map(f => ({
        id: f.trackId, title: f.title, artist: f.artist, duration: f.duration, uploadedAt: f.uploadedAt,
        artistId: f.artistId, albumId: null, trackNumber: null, isExplicit: false, isLikedByMe: f.isLikedByMe ?? false, coverUrl: f.coverUrl
    })) || [];

    const [leftWidth, setLeftWidth] = useState(250);
    const [rightWidth, setRightWidth] = useState(280);

    const [isLeftOpen, setIsLeftOpen] = useState(true);
    const { isRightOpen, rightTab, setRightOpen, setRightTab } = useUIStore();

    const clampWidth = useCallback((w: number) => {
        const maxW = typeof window !== 'undefined' ? window.innerWidth * 0.25 : 300;
        return Math.min(maxW, Math.max(200, w));
    }, []);

    return (
        <div className="flex h-full w-full overflow-hidden text-sm gap-[3px]">

            {/* SECTION 1 */}
            <section
                className="relative flex flex-col shrink-0 rounded-xl bg-bg-elevated border border-border shadow-sm overflow-hidden transition-[width,min-width,max-width] duration-300 ease-in-out"
                style={{
                    width: isLeftOpen ? leftWidth : '5%',
                    maxWidth: isLeftOpen ? '25vw' : '5%',
                    minWidth: isLeftOpen ? '200px' : '5%'
                }}
            >
                <div className={cn(
                    "flex-1 overflow-y-auto p-5 transition-opacity duration-300",
                    scrollbarClasses,
                    isLeftOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}>

                    {/* БЛОК ИЗБРАННОЕ */}
                    <Link to="/favorites" className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-accent/10 transition-colors group">
                        <div className="w-14 h-14 shrink-0 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-105">
                            <HeartIcon filled={true} className="text-white w-6 h-6" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-[17px] font-semibold text-fg tracking-tight truncate group-hover:text-accent transition-colors">Избранное</span>
                            <span className="text-[13px] text-fg-muted truncate">
                                {favoritesQ.data?.length ?? 0} {pluralTracks(favoritesQ.data?.length ?? 0)}
                            </span>
                        </div>
                    </Link>

                    {/* Разделитель */}
                    <div className="h-px bg-border my-4 -mx-2" />

                    {/* ПОДПИСКИ (Друзья) */}
                    {followingQ.data?.map(u => (
                        <FriendSidebarItem key={u.userId} user={u} nameMap={nameMap} />
                    ))}

                    {/* ПОДПИСКИ (Артисты) */}
                    {followedArtistsQ.data?.map(a => (
                        <ArtistSidebarItem key={a.artistId} artist={a} />
                    ))}
                </div>

                {!isLeftOpen && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="rotate-[-90deg] whitespace-nowrap text-fg-muted font-bold tracking-widest uppercase text-xs">
                            Подписки
                        </span>
                    </div>
                )}
            </section>

            {/* SEPARATOR 1 */}
            {isLeftOpen && (
                <ResizeHandle
                    width={leftWidth}
                    onWidthChange={w => setLeftWidth(clampWidth(w))}
                    direction={1}
                />
            )}

            {/* SECTION 2 */}
            <section className="relative flex-1 flex flex-col min-w-[350px] rounded-xl bg-bg-elevated border border-border shadow-sm overflow-hidden">

                <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-accent/20 to-transparent pointer-events-none z-0" />

                <div className="absolute top-4 left-4 z-30 bg-bg rounded-md border border-border shadow-sm">
                    <Tooltip position="right" content={isLeftOpen ? "Свернуть панель" : "Развернуть панель"}>
                        <button
                            onClick={() => setIsLeftOpen(!isLeftOpen)}
                            className={cn(
                                "relative p-1.5 rounded-md transition-colors",
                                !isLeftOpen ? 'bg-bg-elevated text-accent shadow-sm' : 'text-fg-muted hover:text-fg hover:bg-bg-elevated/50'
                            )}
                        >
                            <SidebarLeftIcon />
                        </button>
                    </Tooltip>
                </div>

                <div className="absolute top-4 right-4 z-30 bg-bg rounded-md border border-border shadow-sm">
                    <Tooltip position="left" content={isRightOpen ? "Скрыть панель" : "Показать панель"}>
                        <button
                            onClick={() => setRightOpen(!isRightOpen)}
                            className={cn(
                                "relative p-1.5 rounded-md transition-colors",
                                !isRightOpen ? 'bg-bg-elevated text-accent shadow-sm' : 'text-fg-muted hover:text-fg hover:bg-bg-elevated/50'
                            )}
                        >
                            <SidebarRightIcon />
                        </button>
                    </Tooltip>
                </div>

                <div className={cn("flex-1 overflow-y-auto p-6 relative z-10 space-y-8", scrollbarClasses)}>

                    <div className="pt-12">
                        <h1 className="text-2xl font-bold tracking-tight text-left">
                            Привет, {user?.displayName ?? user?.email ?? 'Гость'}
                        </h1>
                    </div>

                    {artists.data && artists.data.length > 0 && (
                        <Section title="Популярные артисты">
                            <ArtistSlider artists={artists.data} />
                        </Section>
                    )}

                    <Section title="Лента подписок">
                        {feed.isLoading && <p className="text-fg-muted">Загрузка ленты...</p>}
                        {feed.data && feed.data.length > 0 ? (
                            <div className={scrollableListClasses}>
                                <ul>
                                    {feedTracks.map((t, i) => (
                                        <TrackRow
                                            key={`feed-${t.id}-${i}`}
                                            number={i + 1}
                                            track={t}
                                            onPlay={() => handlePlayContext(feedTracks, i)}
                                        />
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            !feed.isLoading && (
                                <div className="rounded-md border border-border bg-bg p-6 text-center text-fg-muted">
                                    Вы пока ни на кого не подписаны.
                                </div>
                            )
                        )}
                    </Section>

                    {forYou.data && forYou.data.length > 0 && (
                        <Section title="Для вас">
                            <div className={scrollableListClasses}>
                                <ul>
                                    {forYou.data.map((t, i) => (
                                        <TrackRow
                                            key={`foryou-${t.id}-${i}`}
                                            track={t}
                                            onPlay={() => handlePlayContext(forYou.data!, i)}
                                        />
                                    ))}
                                </ul>
                            </div>
                        </Section>
                    )}

                    <Section title={popularEmpty ? 'Каталог' : 'Популярное'} actionTo="/catalog" actionLabel="Смотреть все">
                        <div className={scrollableListClasses}>
                            {popular.isLoading && <p className="text-fg-muted">Загрузка...</p>}
                            {popular.data && popular.data.length > 0 && (
                                <ul>
                                    {popular.data.map((t, i) => (
                                        <TrackRow
                                            key={`pop-${t.id}-${i}`}
                                            track={t}
                                            onPlay={() => handlePlayContext(popular.data!, i)}
                                        />
                                    ))}
                                </ul>
                            )}
                            {popularEmpty && catalog.data && catalog.data.length > 0 && (
                                <ul>
                                    {catalog.data.map((t, i) => (
                                        <TrackRow
                                            key={`cat-${t.id}-${i}`}
                                            track={t}
                                            onPlay={() => handlePlayContext(catalog.data!, i)}
                                        />
                                    ))}
                                </ul>
                            )}
                        </div>
                    </Section>

                </div>
            </section>

            {/* SEPARATOR 2 */}
            {isRightOpen && (
                <ResizeHandle
                    width={rightWidth}
                    onWidthChange={w => setRightWidth(clampWidth(w))}
                    direction={-1}
                />
            )}

            {/* SECTION 3 */}
            <div
                className={cn(
                    "transition-[width,opacity] duration-300 ease-in-out overflow-hidden flex shrink-0",
                    isRightOpen ? "opacity-100" : "opacity-0"
                )}
                style={{ width: isRightOpen ? rightWidth : 0, maxWidth: '25vw' }}
            >
                <section className="flex flex-col w-full h-full min-w-[200px] rounded-xl bg-bg-elevated border border-border shadow-sm overflow-hidden">
                    <div className={cn("flex-1 overflow-y-auto p-5", scrollbarClasses)}>

                        <div className="flex items-center justify-between mb-5">
                            <h2 className="flex items-center gap-2 text-lg font-semibold truncate mr-2">
                                {rightTab === 'friends' ? 'Активность друзей' :
                                    rightTab === 'queue' ? 'Очередь' : 'Сейчас играет'}
                            </h2>
                            <div className="flex gap-2">
                                <Tooltip position="bottom" content="Активность друзей">
                                    <button
                                        onClick={() => {
                                            setRightTab(rightTab === 'friends' ? 'now-playing' : 'friends');
                                        }}
                                        className={cn(
                                            "p-1.5 rounded-md transition-colors shadow-sm border",
                                            rightTab === 'friends'
                                                ? "bg-accent text-accent-fg border-accent"
                                                : "bg-bg border-border text-fg-muted hover:text-fg hover:bg-bg-elevated"
                                        )}
                                    >
                                        <UsersIcon className="w-4 h-4" />
                                    </button>
                                </Tooltip>
                            </div>
                        </div>

                        <div className="flex-1 pb-10">
                            {rightTab === 'friends' ? (
                                friendsFeed.data && friendsFeed.data.length > 0 ? (
                                    <FriendsFeedList items={friendsFeed.data} />
                                ) : (
                                    <p className="text-fg-muted text-center mt-4">Нет недавней активности</p>
                                )
                            ) : rightTab === 'queue' ? (
                                <QueueView />
                            ) : (
                                <NowPlayingView onOpenQueue={() => setRightTab('queue')} />
                            )}
                        </div>
                    </div>
                </section>
            </div>

        </div>
    );
}

function Section({
    title,
    actionTo,
    actionLabel,
    children,
}: {
    title: string;
    actionTo?: string;
    actionLabel?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-3">
            <header className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{title}</h2>
                {actionTo && (
                    <Link to={actionTo} className="text-xs font-medium text-accent hover:underline">
                        {actionLabel}
                    </Link>
                )}
            </header>
            {children}
        </div>
    );
}

function QueueView() {
    const queue = usePlayer(s => s.queue);
    const index = usePlayer(s => s.index);
    const removeFromQueue = usePlayer(s => s.removeFromQueue);
    const playQueueStore = usePlayer(s => s.playQueue);

    if (queue.length === 0) {
        return (
            <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-border bg-bg/50">
                <div className="text-center text-fg-muted">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-bg-elevated mb-3 shadow-sm">
                        <MusicIcon />
                    </div>
                    <p className="text-xs">Очередь пуста</p>
                </div>
            </div>
        );
    }

    const currentTrack = queue[index];
    const upcoming = queue.map((t, i) => ({ track: t, originalIndex: i })).slice(index + 1);

    return (
        <div className="space-y-6">
            {currentTrack && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-fg">Сейчас играет</h3>
                    <div className="rounded-md border border-border bg-bg-elevated p-3 flex items-center gap-3">
                        <Link to={`/tracks/${currentTrack.id}`} className="shrink-0">
                            <div
                                className="w-12 h-12 rounded bg-cover bg-center bg-bg shadow-sm"
                                style={{ backgroundImage: currentTrack.coverUrl ? `url(${currentTrack.coverUrl})` : undefined }}
                            />
                        </Link>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate text-fg hover:underline">
                                <Link to={`/tracks/${currentTrack.id}`}>{currentTrack.title}</Link>
                            </div>
                            <div className="text-xs text-fg-muted truncate">
                                {currentTrack.artistId ? (
                                    <Link to={`/artists/${currentTrack.artistId}`} className="hover:underline hover:text-fg">
                                        {currentTrack.artist || 'Неизвестный исполнитель'}
                                    </Link>
                                ) : (
                                    currentTrack.artist || 'Неизвестный исполнитель'
                                )}
                                {currentTrack.featuredArtists?.map((fa: { id: string, name: string }) => (
                                    <span key={fa.id}>
                                        {', feat. '}
                                        <Link to={`/artists/${fa.id}`} className="hover:underline hover:text-fg">{fa.name}</Link>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* СПИСОК "ДАЛЕЕ" */}
            {upcoming.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-fg">Далее</h3>
                    <ul className="rounded-md border border-border bg-bg-elevated">
                        {upcoming.map(({ track, originalIndex }) => (
                            <TrackRow
                                key={`queue-${track.id}-${originalIndex}`}
                                track={track as any}
                                onPlay={() => playQueueStore(queue, originalIndex)}
                                onRemoveFromQueue={() => removeFromQueue(originalIndex)}
                            />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function NowPlayingView({ onOpenQueue }: { onOpenQueue: () => void }) {
    const queue = usePlayer(s => s.queue);
    const index = usePlayer(s => s.index);
    const currentTrack = queue[index];
    const nextTrack = queue[index + 1];
    const playQueueStore = usePlayer(s => s.playQueue);

    const artistId = currentTrack?.artistId;

    const artistQ = useQuery({
        queryKey: ['artist', artistId],
        queryFn: () => getArtist(artistId!),
        enabled: !!artistId,
    });

    const followedQ = useQuery({
        queryKey: ['followed-artists'],
        queryFn: listFollowedArtists,
    });

    const qc = useQueryClient();
    const { user } = useAuth();

    const follow = useMutation({
        mutationFn: () => followArtist(artistId!),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['followed-artists'] }),
    });

    const unfollow = useMutation({
        mutationFn: () => unfollowArtist(artistId!),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['followed-artists'] }),
    });

    if (queue.length === 0 || !currentTrack) {
        return (
            <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-border bg-bg/50">
                <div className="text-center text-fg-muted">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-bg-elevated mb-3 shadow-sm">
                        <MusicIcon />
                    </div>
                    <p className="text-xs">Очередь пуста</p>
                </div>
            </div>
        );
    }

    const a = artistQ.data;
    const isOwner = !!user && !!(a?.ownerUserId ?? a?.createdByUserId) && user.id === (a?.ownerUserId ?? a?.createdByUserId);
    const isFollowed = followedQ.data?.some((fa: { artistId: string }) => fa.artistId === artistId);

    function formatNumber(n: number): string {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return String(n);
    }

    return (
        <div className="space-y-6">
            {/* trackCover */}
            <div
                className="w-full aspect-square rounded-xl bg-bg-elevated border border-border bg-cover bg-center shadow-sm"
                style={{ backgroundImage: currentTrack.coverUrl ? `url(${currentTrack.coverUrl})` : undefined }}
            >
                {!currentTrack.coverUrl && (
                    <div className="w-full h-full flex items-center justify-center text-fg-muted/30">
                        <MusicIcon className="w-20 h-20" />
                    </div>
                )}
            </div>

            <div className="flex flex-col min-w-0 px-1">
                <Link to={`/tracks/${currentTrack.id}`} className="text-2xl font-bold truncate text-fg hover:underline">
                    {currentTrack.title}
                </Link>
                <div className="text-base text-fg-muted truncate mt-1">
                    {currentTrack.artistId ? (
                        <Link to={`/artists/${currentTrack.artistId}`} className="hover:underline hover:text-fg transition-colors">
                            {currentTrack.artist || 'Неизвестный исполнитель'}
                        </Link>
                    ) : (
                        currentTrack.artist || 'Неизвестный исполнитель'
                    )}
                    {currentTrack.featuredArtists?.map((fa: { id: string, name: string }) => (
                        <span key={fa.id}>
                            {', feat. '}
                            <Link to={`/artists/${fa.id}`} className="hover:underline hover:text-fg transition-colors">{fa.name}</Link>
                        </span>
                    ))}
                </div>
            </div>

            {/* Artist info */}
            {a && (
                <div className="rounded-xl overflow-hidden border border-border bg-bg-elevated shadow-sm flex flex-col">
                    {/* ArtistBanner */}
                    <div
                        className="h-32 w-full bg-cover bg-center relative border-b border-border bg-bg"
                        style={{ backgroundImage: a.bannerUrl ? `url('${a.bannerUrl}')` : undefined }}
                    >
                        <span className="absolute top-3 left-4 text-xs font-bold uppercase tracking-wider text-white bg-black/60 px-2 py-1 rounded">
                            Об артисте
                        </span>
                    </div>

                    <div className="p-4 space-y-3 bg-[rgb(var(--bg-accent))]">
                        <Link to={`/artists/${a.id}`} className="text-xl font-bold hover:underline block text-fg">
                            {a.name}
                        </Link>

                        {/* Слушатели в месяц | Кнопка */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-sm font-medium text-fg-muted">
                                {typeof a.monthlyListeners === 'number' ? `${formatNumber(a.monthlyListeners)} слушателей за месяц` : ' '}
                            </span>
                            {!isOwner && (
                                <button
                                    onClick={() => isFollowed ? unfollow.mutate() : follow.mutate()}
                                    disabled={follow.isPending || unfollow.isPending}
                                    className={cn(
                                        "rounded-full px-5 py-1.5 text-xs font-semibold transition-transform active:scale-95 disabled:opacity-50",
                                        isFollowed
                                            ? "border border-border text-fg hover:bg-bg-elevated"
                                            : "bg-fg text-bg hover:opacity-90"
                                    )}
                                >
                                    {isFollowed ? 'Отписаться' : 'Подписаться'}
                                </button>
                            )}
                        </div>

                        {/* Информация "Об артисте"*/}
                        {a.bio && (
                            <p className="text-sm text-fg-muted line-clamp-3 leading-relaxed">
                                {a.bio}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Следующее в очереди */}
            {nextTrack && (
                <div className="space-y-3 pt-6 border-t border-border">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-sm font-bold text-fg">Следующее в очереди</h3>
                        <button onClick={onOpenQueue} className="text-xs font-medium text-accent hover:underline transition-colors">
                            Открыть очередь
                        </button>
                    </div>
                    <ul className="rounded-lg border border-border bg-bg-elevated overflow-hidden -mx-1">
                        <TrackRow
                            track={nextTrack as any}
                            onPlay={() => playQueueStore(queue, index + 1)}
                        />
                    </ul>
                </div>
            )}
        </div>
    );
}

function ArtistSlider({ artists }: { artists: import('@/shared/types').ArtistSummary[] }) {
    const scrollRef = useRef<HTMLUListElement>(null);
    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(true);

    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
        setShowLeft(scrollLeft > 0);
        setShowRight(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 2);
    };

    useEffect(() => {
        handleScroll();
        window.addEventListener('resize', handleScroll);
        return () => window.removeEventListener('resize', handleScroll);
    }, [artists]);

    const scroll = (dir: 'left' | 'right') => {
        if (!scrollRef.current) return;
        const clientWidth = scrollRef.current.clientWidth;
        const scrollAmount = clientWidth * 0.75;
        scrollRef.current.scrollBy({
            left: dir === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    };

    return (
        <div className="relative group/slider -mx-2 px-2">
            {showLeft && (
                <button
                    onClick={() => scroll('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex size-8 items-center justify-center rounded-full border border-border bg-bg-elevated shadow-md text-fg hover:text-accent transition-all opacity-0 group-hover/slider:opacity-100"
                >
                    <ArrowRightIcon className="rotate-180" />
                </button>
            )}

            <ul
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex gap-4 overflow-x-auto scroll-smooth py-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
                {artists.map((a, i) => (
                    <li key={`artist-${a.id}-${i}`} className="snap-start shrink-0 w-28 sm:w-32 md:w-36">
                        <Link
                            to={`/artists/${a.id}`}
                            className="block space-y-2 rounded-md border border-border bg-bg p-3 hover:bg-bg/70 hover:underline transition-colors"
                        >
                            <div
                                className="aspect-square w-full rounded-full bg-bg-elevated bg-cover bg-center flex items-center justify-center text-xl font-bold text-fg-muted mx-auto"
                                style={{ backgroundImage: a.avatarUrl ? `url('${a.avatarUrl}')` : undefined }}
                                aria-hidden={!!a.avatarUrl}
                            >
                                {!a.avatarUrl && a.name ? a.name.charAt(0).toUpperCase() : null}
                            </div>
                            <div className="truncate text-center text-xs font-medium">{a.name}</div>
                        </Link>
                    </li>
                ))}
            </ul>

            {showRight && (
                <button
                    onClick={() => scroll('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex size-8 items-center justify-center rounded-full border border-border bg-bg-elevated shadow-md text-fg hover:text-accent transition-all opacity-0 group-hover/slider:opacity-100"
                >
                    <ArrowRightIcon />
                </button>
            )}
        </div>
    );
}

function FriendsFeedList({ items }: { items: FriendFeedItem[] }) {
    const userIds = Array.from(new Set(items.map((i) => i.userId)));
    const namesQ = useQuery({
        queryKey: ['user-names', ...userIds.sort()],
        queryFn: () => batchUsers(userIds),
        enabled: userIds.length > 0,
        staleTime: 5 * 60 * 1000,
    });
    const nameMap: Record<string, string> = {};
    for (const u of namesQ.data ?? []) nameMap[u.id] = u.displayName;

    return (
        <div className="space-y-3">
            {items.map((item, i) => {
                const friendName = nameMap[item.userId] ?? `${item.userId.slice(0, 8)}...`;
                return (
                    <div
                        key={`friend-feed-${item.userId}-${item.track.id}-${i}`}
                        className="overflow-hidden rounded-md border border-border"
                    >
                        <div className="flex items-center justify-between gap-2 bg-bg px-3 py-2 text-[11px] text-fg-muted">
                            <span className="truncate">
                                <Link to={`/users/${item.userId}`} className="font-medium text-fg hover:underline">
                                    {friendName}
                                </Link>
                            </span>
                            <span className="shrink-0" title={new Date(item.lastPlayedAt).toLocaleString('ru-RU')}>
                                {formatRelativeTime(item.lastPlayedAt)}
                            </span>
                        </div>
                        <ul className="bg-bg-elevated">
                            <TrackRow track={item.track} />
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}

function formatRelativeTime(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const min = Math.round(diffMs / 60_000);
    if (min < 1) return 'Только что';
    if (min < 60) return `${min} м`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h} ч`;
    const days = Math.round(h / 24);
    if (days < 7) return `${days} д`;
    return d.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
}

function pluralTracks(n: number): string {
    const last2 = n % 100;
    const last1 = n % 10;
    if (last2 >= 11 && last2 <= 14) return 'треков';
    if (last1 === 1) return 'трек';
    if (last1 >= 2 && last1 <= 4) return 'трека';
    return 'треков';
}