import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getFriendsFeed, followArtist, unfollowArtist, listFollowedArtists } from '@/shared/api/follows';
import { batchUsers } from '@/shared/api/users';
import { getArtist } from '@/shared/api/artists';
import { TrackRow } from '@/pages/track-row';
import { useUIStore } from '@/shared/store/uiStore';
import { usePlayer } from '@/features/player/store';
import { useAuth } from '@/features/auth/useAuth';
import { Tooltip } from '@/shared/ui/Tooltip';
import { UsersIcon, SidebarRightIcon, MusicIcon } from '@/shared/ui/icons';
import { LikeButton } from '@/features/player/Player';
import { useToggleTrackLike } from '@/features/track/useToggleTrackLike';
import { cn } from '@/shared/lib/cn';
import type { FriendFeedItem } from '@/shared/types';

const scrollbarClasses = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full";

export function SidebarRight() {
    const { isRightOpen, setRightOpen, rightWidth, rightTab, setRightTab, isResizingRight } = useUIStore();
    const friendsFeed = useQuery({ queryKey: ['friends-feed'], queryFn: () => getFriendsFeed(20) });

    const getHeaderText = () => {
        if (rightTab === 'friends') return 'Активность друзей';
        if (rightTab === 'queue') return 'Очередь';
        return 'Сейчас играет';
    };

    return (
        <section
            className={cn(
                "relative flex flex-col shrink-0 rounded-xl bg-bg-elevated border border-border shadow-sm overflow-hidden",
                !isResizingRight && "transition-[width,min-width,max-width] duration-300 ease-in-out"
            )}
            style={{ width: isRightOpen ? rightWidth : '60px', maxWidth: '25vw' }}
        >
            <div className={cn("flex-1 flex flex-col min-h-0", scrollbarClasses)}>

                <div className={cn("flex items-center px-4 pt-5 pb-2 min-w-0", isRightOpen ? "justify-between" : "justify-center")}>
                    <Tooltip content={isRightOpen ? "Свернуть" : "Развернуть"} position="left">
                        <button
                            onClick={() => setRightOpen(!isRightOpen)}
                            className="flex items-center gap-3 tracking-tight hover:text-fg transition-colors min-w-0"
                        >
                            <SidebarRightIcon className={cn("shrink-0 transition-transform", !isRightOpen && "rotate-180")} />
                            {isRightOpen && (
                                <span className="font-bold text-[13px] uppercase tracking-wider truncate whitespace-nowrap">
                                    {getHeaderText()}
                                </span>
                            )}
                        </button>
                    </Tooltip>
                </div>

                <div className={cn(
                    "flex-1 overflow-y-auto p-5 transition-opacity duration-200 pb-10",
                    !isRightOpen && "opacity-0 pointer-events-none"
                )}>
                    {rightTab === 'friends' ? (
                        <FriendsFeedList items={friendsFeed.data || []} />
                    ) : rightTab === 'queue' ? (
                        <QueueView />
                    ) : (
                        <NowPlayingView onOpenQueue={() => setRightTab('queue')} />
                    )}
                </div>
            </div>
        </section>
    );
}

function QueueView() {
    const queue = usePlayer(s => s.queue);
    const index = usePlayer(s => s.index);
    const removeFromQueue = usePlayer(s => s.removeFromQueue);
    const playQueueStore = usePlayer(s => s.playQueue);

    if (queue.length === 0) return <div className="text-center tracking-tight mt-10"><MusicIcon className="mx-auto mb-2" /> Очередь пуста</div>;

    const currentTrack = queue[index];
    const upcoming = queue.map((t, i) => ({ track: t, originalIndex: i })).slice(index + 1);

    return (
        <div className="space-y-6">
            {currentTrack && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-fg">Сейчас играет</h3>
                    <div className="rounded-md border border-border bg-bg-elevated p-3 flex items-center gap-3">
                        <div
                            className="w-12 h-12 rounded bg-bg-elevated flex items-center justify-center tracking-tight shadow-sm bg-cover bg-center overflow-hidden"
                            style={{ backgroundImage: currentTrack.coverUrl ? `url(${currentTrack.coverUrl})` : undefined }}
                        >
                            {!currentTrack.coverUrl && <MusicIcon className="w-5 h-5 opacity-40" />}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{currentTrack.title}</div>
                            <div className="text-xs tracking-tight truncate">{currentTrack.artist || 'Неизвестный'}</div>
                        </div>
                    </div>
                </div>
            )}
            {upcoming.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-fg">Далее</h3>
                    <ul className="rounded-md border border-border overflow-hidden">
                        {upcoming.map(({ track, originalIndex }) => (
                            <TrackRow key={`q-${track.id}-${originalIndex}`} track={track as any} onPlay={() => playQueueStore(queue, originalIndex)} onRemoveFromQueue={() => removeFromQueue(originalIndex)} />
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
    const artistId = currentTrack?.artistId;
    const playQueueStore = usePlayer(s => s.playQueue);

    const artistQ = useQuery({ queryKey: ['artist', artistId], queryFn: () => getArtist(artistId!), enabled: !!artistId });
    const followedQ = useQuery({ queryKey: ['followed-artists'], queryFn: listFollowedArtists });
    const likeApi = useToggleTrackLike();
    const updateTrackState = usePlayer(s => s.updateTrackState);
    const qc = useQueryClient();
    const { user } = useAuth();

    if (!currentTrack) return <div className="text-center tracking-tight mt-10">Ничего не играет</div>;

    const a = artistQ.data;
    const isFollowed = followedQ.data?.some(fa => fa.artistId === artistId);
    const isLiked = currentTrack.isLikedByMe ?? false;

    const isOwner = !!user && !!a && (a.ownerUserId === user.id || a.createdByUserId === user.id);

    return (
        <div className="space-y-6">
            <div
                className="w-full aspect-square rounded-xl bg-bg-elevated flex items-center justify-center tracking-tight shadow-md bg-cover bg-center overflow-hidden"
                style={{ backgroundImage: currentTrack.coverUrl ? `url(${currentTrack.coverUrl})` : undefined }}
            >
                {!currentTrack.coverUrl && <MusicIcon className="opacity-50" />}
            </div>

            <div className="flex items-center justify-between gap-3 min-w-0">
                <div className="flex flex-col min-w-0">
                    <Link to={`/tracks/${currentTrack.id}`} className="text-2xl font-bold truncate hover:underline">{currentTrack.title}</Link>
                    <div className="tracking-tight truncate mt-1">
                        {artistId ? (
                            <Link to={`/artists/${artistId}`} className="hover:underline hover:text-fg transition-colors">{currentTrack.artist}</Link>
                        ) : currentTrack.artist}

                        {currentTrack.featuredArtists?.map((fa: { id: string, name: string }) => (
                            <span key={fa.id}>
                                {', feat. '}
                                <Link
                                    to={`/artists/${fa.id}`}
                                    className="hover:underline hover:text-fg transition-colors"
                                >
                                    {fa.name}
                                </Link>
                            </span>
                        ))}

                    </div>
                </div>
                <div className="shrink-0 scale-110 mr-1">
                    <LikeButton
                        isLiked={isLiked}
                        onClick={() => {
                            likeApi.mutate({ trackId: currentTrack.id, nextLiked: !isLiked });
                            updateTrackState(currentTrack.id, { isLikedByMe: !isLiked });
                        }}
                    />
                </div>
            </div>

            {a && (
                <div className="rounded-xl overflow-hidden border border-border bg-bg-elevated shadow-sm">
                    <div className="h-32 bg-cover bg-center relative" style={{ backgroundImage: a.bannerUrl ? `url('${a.bannerUrl}')` : undefined }}>
                        <span className="absolute top-3 left-4 text-[10px] font-bold uppercase bg-black/60 px-2 py-1 rounded text-white">Об артисте</span>
                    </div>
                    <div className="p-4 space-y-3 min-w-0">
                        <Link to={`/artists/${a.id}`} className="text-lg font-bold hover:underline block truncate">{a.name}</Link>
                        <div className="flex justify-between items-center gap-2">
                            <span className="text-xs tracking-tight font-medium truncate">{a.monthlyListeners?.toLocaleString()} слушателей</span>
                            {/* Скрыть кнопку, если пользователь владелец */}
                            {!isOwner && (
                                <button onClick={() => isFollowed ? unfollowArtist(a.id) : followArtist(a.id)} className={cn("px-5 py-1.5 shrink-0 rounded-full text-xs font-bold transition-all", isFollowed ? "border border-border text-fg hover:bg-bg" : "bg-fg text-bg hover:opacity-80")}>
                                    {isFollowed ? 'Отписаться' : 'Подписаться'}
                                </button>
                            )}
                        </div>
                        {a.bio && <p className="text-xs tracking-tight line-clamp-3 leading-relaxed whitespace-pre-wrap">{a.bio}</p>}
                    </div>
                </div>
            )}

            {nextTrack && (
                <div className="space-y-3 border-t border-border pt-6">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-sm font-bold">Следующее в очереди</h3>
                        <button onClick={onOpenQueue} className="text-xs text-accent hover:underline">Открыть очередь</button>
                    </div>
                    <ul className="rounded-lg border border-border bg-bg-elevated overflow-hidden">
                        <TrackRow track={nextTrack as any} onPlay={() => playQueueStore(queue, index + 1)} />
                    </ul>
                </div>
            )}
        </div>
    );
}

function FriendsFeedList({ items }: { items: FriendFeedItem[] }) {
    const userIds = Array.from(new Set(items.map(i => i.userId)));
    const namesQ = useQuery({ queryKey: ['user-names', ...userIds.sort()], queryFn: () => batchUsers(userIds), enabled: userIds.length > 0, staleTime: 5 * 60 * 1000 });
    const nameMap: Record<string, string> = {};
    for (const u of namesQ.data ?? []) nameMap[u.id] = u.displayName;

    if (items.length === 0) return <p className="text-center tracking-tight mt-10 text-sm">Нет активности друзей</p>;

    return (
        <div className="space-y-4">
            {items.map((item, i) => (
                <div key={`${item.userId}-${i}`} className="overflow-hidden rounded-md border border-border">
                    <div className="bg-bg px-3 py-1.5 text-[11px] flex justify-between">
                        <Link to={`/users/${item.userId}`} className="font-bold hover:underline">{nameMap[item.userId] || '...'}</Link>
                        <span className="tracking-tight">{new Date(item.lastPlayedAt).toLocaleDateString('ru')}</span>
                    </div>
                    <ul className="bg-bg-elevated"><TrackRow track={item.track} /></ul>
                </div>
            ))}
        </div>
    );
}