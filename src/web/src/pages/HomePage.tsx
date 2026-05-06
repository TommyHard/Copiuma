import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/useAuth';
import { getFeed, getFriendsFeed } from '@/shared/api/follows';
import { batchUsers } from '@/shared/api/users';
import { forYouTracks, popularTracks, trendingArtists } from '@/shared/api/recommendations';
import { listTracks } from '@/shared/api/catalog';
import { TrackRow } from './track-row';
import type { FriendFeedItem } from '@/shared/types';
import { Tooltip } from '@/shared/ui/Tooltip';
import { SidebarLeftIcon, SidebarRightIcon, UsersIcon, MusicIcon } from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';

const scrollbarClasses = "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-fg-muted/50";

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

export function HomePage() {
    const { user } = useAuth();

    const feed = useQuery({ queryKey: ['feed'], queryFn: () => getFeed(20) });
    const friendsFeed = useQuery({ queryKey: ['friends-feed'], queryFn: () => getFriendsFeed(20) });
    const popular = useQuery({ queryKey: ['popular'], queryFn: () => popularTracks(15) });
    const forYou = useQuery({ queryKey: ['for-you'], queryFn: () => forYouTracks(15) });
    const artists = useQuery({ queryKey: ['trending-artists'], queryFn: () => trendingArtists(8) });

    const popularEmpty = !popular.isLoading && (!popular.data || popular.data.length === 0);
    const catalog = useQuery({
        queryKey: ['catalog', 1],
        queryFn: () => listTracks(1, 15),
        enabled: popularEmpty,
    });

    const [leftWidth, setLeftWidth] = useState(250);
    const [rightWidth, setRightWidth] = useState(280);

    const [isLeftOpen, setIsLeftOpen] = useState(true);
    const [isRightOpen, setIsRightOpen] = useState(true);
    const [rightTab, setRightTab] = useState<'nowPlaying' | 'friends'>('nowPlaying');

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
                    {artists.data && artists.data.length > 0 && (
                        <Section title="Популярные артисты">
                            <ul className="grid grid-cols-2 gap-3 mt-3">
                                {artists.data.map((a, i) => (
                                    <li key={`artist-${a.id}-${i}`}>
                                        <Link
                                            to={`/artists/${a.id}`}
                                            className="block space-y-2 rounded-md border border-border bg-bg p-3 hover:bg-bg/70 transition-colors"
                                        >
                                            <div
                                                className="aspect-square w-full rounded-full bg-bg-elevated bg-cover bg-center flex items-center justify-center text-xl font-bold text-fg-muted"
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
                        </Section>
                    )}
                </div>

                {!isLeftOpen && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="rotate-[-90deg] whitespace-nowrap text-fg-muted font-bold tracking-widest uppercase text-xs">
                            В тренде
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

                {/* GRADIENT */}
                <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-accent/20 to-transparent pointer-events-none z-0" />

                {/* COLLAPSE SECTION 1 */}
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

                {/* COLLAPSE SECTION 3 */}
                <div className="absolute top-4 right-4 z-30 bg-bg rounded-md border border-border shadow-sm">
                    <Tooltip position="left" content={isRightOpen ? "Скрыть панель" : "Показать панель"}>
                        <button
                            onClick={() => setIsRightOpen(!isRightOpen)}
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

                    {forYou.data && forYou.data.length > 0 && (
                        <Section title="Для вас">
                            <ul className="rounded-md border border-border">
                                {forYou.data.map((t, i) => (
                                    <TrackRow key={`foryou-${t.id}-${i}`} track={t} />
                                ))}
                            </ul>
                        </Section>
                    )}

                    <Section title={popularEmpty ? 'Каталог' : 'Популярное'} actionTo="/catalog" actionLabel="Смотреть все">
                        {popular.isLoading && <p className="text-fg-muted">Загрузка...</p>}
                        {popular.data && popular.data.length > 0 && (
                            <ul className="rounded-md border border-border">
                                {popular.data.map((t, i) => (
                                    <TrackRow key={`pop-${t.id}-${i}`} track={t} />
                                ))}
                            </ul>
                        )}
                        {popularEmpty && catalog.data && catalog.data.length > 0 && (
                            <ul className="rounded-md">
                                {catalog.data.map((t, i) => (
                                    <TrackRow key={`cat-${t.id}-${i}`} track={t} />
                                ))}
                            </ul>
                        )}
                    </Section>

                    <Section title="Лента подписок">
                        {feed.isLoading && <p className="text-fg-muted">Загрузка ленты...</p>}
                        {feed.data && feed.data.length > 0 ? (
                            <ul className="rounded-md border border-border">
                                {feed.data.map((f, i) => (
                                    <TrackRow
                                        key={`feed-${f.trackId}-${i}`}
                                        number={i + 1}
                                        track={{
                                            id: f.trackId,
                                            title: f.title,
                                            artist: f.artist,
                                            duration: f.duration,
                                            uploadedAt: f.uploadedAt,
                                            artistId: f.artistId,
                                            albumId: null,
                                            trackNumber: null,
                                            isExplicit: false,
                                            isLikedByMe: f.isLikedByMe ?? false,
                                        }}
                                    />
                                ))}
                            </ul>
                        ) : (
                            !feed.isLoading && (
                                <div className="rounded-md border border-border bg-bg p-6 text-center text-fg-muted">
                                    Вы пока ни на кого не подписаны.
                                </div>
                            )
                        )}
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
                            <h2 className="text-lg font-semibold truncate mr-2">
                                {rightTab === 'nowPlaying' ? 'Сейчас играет' : 'Активность'}
                            </h2>

                            <Tooltip position="left" content={rightTab === 'nowPlaying' ? "Смотреть активность друзей" : "Вернуться к плееру"}>
                                <button
                                    onClick={() => setRightTab(prev => prev === 'nowPlaying' ? 'friends' : 'nowPlaying')}
                                    className="relative p-1.5 rounded-md border border-border bg-bg hover:bg-bg-elevated transition-colors text-fg-muted hover:text-fg shadow-sm shrink-0"
                                >
                                    {rightTab === 'nowPlaying' ? <UsersIcon /> : <MusicIcon />}
                                </button>
                            </Tooltip>
                        </div>

                        <div className="flex-1">
                            {rightTab === 'friends' ? (
                                friendsFeed.data && friendsFeed.data.length > 0 ? (
                                    <FriendsFeedList items={friendsFeed.data} />
                                ) : (
                                    <p className="text-fg-muted text-center mt-4">Нет недавней активности</p>
                                )
                            ) : (
                                <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-border bg-bg/50">
                                    <div className="text-center text-fg-muted">
                                        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-bg-elevated mb-3 shadow-sm">
                                            <MusicIcon />
                                        </div>
                                        <p className="text-xs">Музыка не воспроизводится</p>
                                    </div>
                                </div>
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