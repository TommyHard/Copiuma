import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { listFavorites } from '@/shared/api/tracks';
import { getPublicUserProfile } from '@/shared/api/profile';
import { listPlaylists, addTrack } from '@/shared/api/playlists';
import { usePlayTrack } from '@/features/player/usePlayTrack';
import { useToggleTrackLike } from '@/features/track/useToggleTrackLike';
import { useAuth } from '@/features/auth/useAuth';
import { HeartIcon, SearchIcon, PlayIcon, MusicIcon, ArrowRightIcon, PlusIcon, DownloadIcon, ClockIcon } from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';
import { Tooltip } from '@/shared/ui/Tooltip';
import { useContextMenu, ContextMenuPortal, ContextMenuItem, ContextMenuSub, ContextMenuSeparator } from '@/shared/ui/ContextMenu';
import { useToggleOfflineForTrack } from './OfflinePage';

type SortField = 'date' | 'title' | 'artist' | 'album';
type SortOrder = 'asc' | 'desc';

const FIELDS: { value: SortField; label: string }[] = [
    { value: 'date', label: 'Дата добавления' },
    { value: 'title', label: 'Название' },
    { value: 'artist', label: 'Исполнитель' },
    { value: 'album', label: 'Альбом' },
];

function HighlightedText({ text, query }: { text: string; query: string }) {
    if (!query.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase()
                    ? <span key={i} className="text-accent bg-accent/20 rounded-sm">{part}</span>
                    : part
            )}
        </>
    );
}

function formatDuration(d: string | null | undefined): string {
    if (!d) return '-:-';
    const m = /^(?:\d+\.)?(\d{2}):(\d{2}):(\d{2})/.exec(d);
    if (!m) return d;
    const h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ss = parseInt(m[3], 10);
    if (h > 0) return `${h}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    return `${mm}:${ss.toString().padStart(2, '0')}`;
}

export function FavoritesPage() {
    const { user } = useAuth();
    const play = usePlayTrack();
    const unlike = useToggleTrackLike();
    const navigate = useNavigate();
    const qc = useQueryClient();

    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [sortField, setSortField] = useState<SortField>('date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [sortMenuOpen, setSortMenuOpen] = useState(false);

    const [isSticky, setIsSticky] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);

    const [activeResizer, setActiveResizer] = useState<number | null>(null);
    const [isManuallyResized, setIsManuallyResized] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const { isOpen, position, onContextMenu, close } = useContextMenu();
    const [contextTrack, setContextTrack] = useState<any>(null);

    const [colWidths, setColWidths] = useState([320, 180, 140]);

    const COL_LIMITS = useMemo(() => [
        { min: 120 },
        { min: 100 },
        { min: 100 }
    ], []);

    useEffect(() => {
        const el = tableContainerRef.current;
        if (!el) return;

        const observer = new ResizeObserver((entries) => {
            const containerWidth = entries[0].contentRect.width;
            if (containerWidth === 0) return;

            setColWidths(prev => {
                const reservedSpace = 208;
                const maxAllowed = containerWidth - reservedSpace;

                if (!isManuallyResized) {
                    const w0 = Math.max(COL_LIMITS[0].min, maxAllowed * 0.5);
                    const w1 = Math.max(COL_LIMITS[1].min, maxAllowed * 0.28125);
                    const w2 = Math.max(COL_LIMITS[2].min, maxAllowed * 0.21875);
                    return [w0, w1, w2];
                }

                let currentTotal = prev.reduce((a, b) => a + b, 0);

                if (currentTotal <= maxAllowed) return prev;

                let newWidths = [...prev];
                for (let i = 2; i >= 0; i--) {
                    let overage = currentTotal - maxAllowed;
                    if (overage <= 0) break;

                    let shrinkable = newWidths[i] - COL_LIMITS[i].min;
                    if (shrinkable > 0) {
                        let shrinkAmount = Math.min(shrinkable, overage);
                        newWidths[i] -= shrinkAmount;
                        currentTotal -= shrinkAmount;
                    }
                }
                return newWidths;
            });
        });

        observer.observe(el);
        return () => observer.disconnect();
    }, [COL_LIMITS, isManuallyResized]);

    const handleResizeMouseDown = (index: number, e: React.MouseEvent) => {
        e.preventDefault();
        setIsManuallyResized(true);
        setActiveResizer(index);
        const startX = e.clientX;
        const startWidth = colWidths[index];
        const containerWidth = tableContainerRef.current?.clientWidth || 1000;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const delta = moveEvent.clientX - startX;
            setColWidths(prev => {
                const newWidths = [...prev];
                const nextWidth = startWidth + delta;

                const otherColsTotal = prev.reduce((acc, w, i) => i === index ? acc : acc + w, 0);
                const reservedSpace = 208;
                const maxPossible = containerWidth - otherColsTotal - reservedSpace;

                let targetWidth = Math.max(COL_LIMITS[index].min, nextWidth);
                if (targetWidth > maxPossible) {
                    targetWidth = Math.max(maxPossible, COL_LIMITS[index].min);
                }

                newWidths[index] = targetWidth;
                return newWidths;
            });
        };

        const onMouseUp = () => {
            setActiveResizer(null);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
        };

        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const gridTemplateColumns = `32px ${colWidths[0]}px ${colWidths[1]}px ${colWidths[2]}px minmax(80px, 1fr)`;

    const favoritesQ = useQuery({ queryKey: ['favorites'], queryFn: listFavorites });
    const profileQ = useQuery({
        queryKey: ['profile', user?.id],
        queryFn: () => getPublicUserProfile(user!.id),
        enabled: !!user?.id,
    });

    const userAvatar = profileQ.data?.avatarUrl;

    const handleSortChange = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder(field === 'date' ? 'desc' : 'asc');
        }
        setSortMenuOpen(false);
    };

    const processedTracks = useMemo(() => {
        let items = favoritesQ.data ? [...favoritesQ.data] : [];
        if (searchQuery.trim()) {
            items = items.filter(t =>
                t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.artist && t.artist.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        }

        items.sort((a, b) => {
            let res = 0;
            const tA = a as any;
            const tB = b as any;
            if (sortField === 'title') res = a.title.localeCompare(b.title);
            else if (sortField === 'artist') res = (a.artist || '').localeCompare(b.artist || '');
            else if (sortField === 'album') res = (tA.albumTitle || '').localeCompare(tB.albumTitle || '');
            else res = new Date(a.likedAt).getTime() - new Date(b.likedAt).getTime();
            return sortOrder === 'asc' ? res : -res;
        });

        return items;
    }, [favoritesQ.data, searchQuery, sortField, sortOrder]);

    useEffect(() => {
        if (isSearchExpanded) searchInputRef.current?.focus();
    }, [isSearchExpanded]);

    const handleTrackContextMenu = (e: React.MouseEvent, track: any) => {
        setContextTrack(track);
        onContextMenu(e);
    };

    const [playlistSearch, setPlaylistSearch] = useState('');

    useEffect(() => {
        if (!isOpen) setPlaylistSearch('');
    }, [isOpen]);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        const scrollContainer = document.getElementById('main-scroll-container');
        if (!sentinel || !scrollContainer) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsSticky(!entry.isIntersecting);
            },
            {
                root: scrollContainer,
                threshold: 0,
                rootMargin: '-1px 0px 0px 0px'
            }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, []);

    const qPlaylists = useQuery({
        queryKey: ['playlists'],
        queryFn: listPlaylists,
        enabled: isOpen,
        staleTime: 60_000,
    });

    const addTrackToPlaylist = useMutation({
        mutationFn: (playlistId: string) => addTrack(playlistId, contextTrack!.id),
        onSuccess: (_, playlistId) => {
            qc.invalidateQueries({ queryKey: ['playlist', playlistId] });
            close();
        },
    });

    const filteredPlaylists = qPlaylists.data?.filter(p =>
        p.title.toLowerCase().includes(playlistSearch.toLowerCase())
    ) || [];

    const offline = useToggleOfflineForTrack(contextTrack?.id ?? '');

    return (
        <div className="relative flex flex-col min-h-full pb-32">
            {/* GRADIENT */}
            <div className="relative h-[330px] w-full shrink-0 flex items-end px-6 md:px-10 pb-8 gap-6 overflow-hidden bg-accent/90">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                <div className="relative size-48 md:size-60 shrink-0 rounded bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-2xl transition-transform duration-300">
                    <HeartIcon className="!size-24 text-white" filled />
                </div>

                <div className="relative z-10 flex flex-col gap-2">
                    <span className="text-xs md:text-sm font-bold uppercase tracking-widest text-white/90">Плейлист</span>
                    <h1 className="text-5xl md:text-8xl font-black text-white tracking-tight drop-shadow-lg">Избранное</h1>
                    <div className="flex items-center gap-1 mt-5 text-sm text-white font-medium">
                        <div className="size-6 rounded-full bg-accent flex items-center justify-center shrink-0 overflow-hidden">
                            {userAvatar ? <img src={userAvatar} className="size-full object-cover" alt="" /> : <span className="text-[10px]">{user?.displayName?.charAt(0)}</span>}
                        </div>
                        <Link to={`/users/${user?.id}`} className="text-1xl font-bold hover:underline">
                            {user?.displayName || 'Пользователь'}
                        </Link>
                        <span className="text-white/60">•</span>
                        <span>{favoritesQ.data?.length || 0} треков</span>
                    </div>
                </div>
            </div>

            {/* GRADIENT BELOW BANNER */}
            <div
                className="absolute left-0 w-full h-[150px] pointer-events-none bg-gradient-to-b from-accent to-transparent opacity-50"
                style={{ top: '330px' }}
            />

            <div className="relative z-10 px-6 md:px-10 pt-4 space-y-5 w-full max-w-full">
                <div className="flex justify-between items-center h-14">

                    <div className="flex items-center gap-4 justify-end ml-auto">
                        <Tooltip content="Поиск в плейлисте">
                            <div className={cn(
                                "flex items-center gap-2 transition-all duration-300 border border-accent/0 hover:bg-accent/15 rounded-md px-3 py-1.5",
                                isSearchExpanded ? "w-64" : "w-10 cursor-pointer justify-center"
                            )}
                                onClick={() => !isSearchExpanded && setIsSearchExpanded(true)}
                            >
                                <SearchIcon className={cn("size-4 shrink-0 transition-colors tracking-tight")} />
                                {isSearchExpanded && (
                                    <input
                                        ref={searchInputRef}
                                        type="text"
                                        placeholder="Поиск"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onBlur={() => !searchQuery && setIsSearchExpanded(false)}
                                        className="bg-transparent text-sm tracking-tight outline-none w-full"
                                    />
                                )}
                            </div>
                        </Tooltip>

                        <div className="relative">
                            <button
                                onClick={() => setSortMenuOpen(!sortMenuOpen)}
                                className="text-sm tracking-tight font-medium flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-accent/15 transition-colors"
                            >
                                <span>{FIELDS.find(f => f.value === sortField)?.label}</span>
                                <ArrowRightIcon className={cn("w-3.5 h-3.5 transition-transform duration-300", sortOrder === 'asc' ? "-rotate-90" : "rotate-90")} />
                            </button>

                            {sortMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setSortMenuOpen(false)} />
                                    <div className="absolute right-0 top-full mt-2 w-52 bg-bg-elevated border border-border rounded-lg shadow-xl py-2 px-1 z-50">
                                        {FIELDS.map((f) => (
                                            <button
                                                key={f.value}
                                                onClick={() => handleSortChange(f.value)}
                                                className={cn(
                                                    "w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors",
                                                    sortField === f.value ? "text-accent bg-accent/10" : "text-fg hover:bg-fg/5"
                                                )}
                                            >
                                                <span>{f.label}</span>
                                                {sortField === f.value && (
                                                    <ArrowRightIcon className={cn("w-3 h-3", sortOrder === 'asc' ? "-rotate-90" : "rotate-90")} />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* STICKY HEADER */ }
                <div ref={tableContainerRef} className="w-full mt-4">

                    <div ref={sentinelRef} className="w-full h-px pointer-events-none -mb-px" />

                    <div
                        className={cn(
                            "group sticky top-0 z-40 grid gap-4 px-4 py-2 border-b text-md font-bold tracking-tight uppercase tracking-wider w-full transition-all duration-300",
                            isSticky
                                ? "bg-bg-elevated border-border shadow-md backdrop-blur-md"
                                : "bg-transparent border-accent/15"
                        )}
                        style={{ gridTemplateColumns }}
                    >
                        <div className="text-center">#</div>

                        <div className="relative flex items-center">
                            <button
                                onClick={() => handleSortChange('title')}
                                className={cn("truncate hover:text-fg transition-colors flex items-center gap-1", sortField === 'title' && "text-accent")}
                            >
                                Название
                                {sortField === 'title' && <ArrowRightIcon className={cn("size-3 shrink-0", sortOrder === 'asc' ? "-rotate-90" : "rotate-90")} />}
                            </button>
                            <div
                                onMouseDown={(e) => handleResizeMouseDown(0, e)}
                                onDoubleClick={() => setIsManuallyResized(false)}
                                className={cn("absolute -right-3 top-0 bottom-0 w-6 cursor-col-resize z-50 flex justify-center items-center transition-opacity", activeResizer === 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                            >
                                <div className={cn("w-[2px] h-[80%] rounded-full transition-colors", activeResizer === 0 ? "bg-accent h-full" : "bg-fg/20 hover:bg-accent")} />
                            </div>
                        </div>

                        <div className="relative flex items-center">
                            <button
                                onClick={() => handleSortChange('album')}
                                className={cn("truncate hover:text-fg transition-colors flex items-center gap-1", sortField === 'album' && "text-accent")}
                            >
                                Альбом
                                {sortField === 'album' && <ArrowRightIcon className={cn("size-3 shrink-0", sortOrder === 'asc' ? "-rotate-90" : "rotate-90")} />}
                            </button>
                            <div
                                onMouseDown={(e) => handleResizeMouseDown(1, e)}
                                onDoubleClick={() => setIsManuallyResized(false)}
                                className={cn("absolute -right-3 top-0 bottom-0 w-6 cursor-col-resize z-50 flex justify-center items-center transition-opacity", activeResizer === 1 ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                            >
                                <div className={cn("w-[2px] h-[80%] rounded-full transition-colors", activeResizer === 1 ? "bg-accent h-full" : "bg-fg/20 hover:bg-accent")} />
                            </div>
                        </div>

                        <div className="relative flex items-center">
                            <button
                                onClick={() => handleSortChange('date')}
                                className={cn("truncate hover:text-fg transition-colors flex items-center gap-1", sortField === 'date' && "text-accent")}
                            >
                                Дата
                                {sortField === 'date' && <ArrowRightIcon className={cn("size-3 shrink-0", sortOrder === 'asc' ? "-rotate-90" : "rotate-90")} />}
                            </button>
                            <div
                                onMouseDown={(e) => handleResizeMouseDown(2, e)}
                                onDoubleClick={() => setIsManuallyResized(false)}
                                className={cn("absolute -right-3 top-0 bottom-0 w-6 cursor-col-resize z-50 flex justify-center items-center transition-opacity", activeResizer === 2 ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                            >
                                <div className={cn("w-[2px] h-[80%] rounded-full transition-colors", activeResizer === 2 ? "bg-accent h-full" : "bg-fg/20 hover:bg-accent")} />
                            </div>
                        </div>

                        <div className="flex justify-end pr-2">
                            <ClockIcon className="size-4 shrink-0" />
                        </div>
                    </div>

                    <div className="flex flex-col pb-10 w-full mt-2">
                        {processedTracks.map((f, i) => {
                            const trackAny = f as any;
                            const featNames = trackAny.featuredArtists?.map((fa: any) => fa.name).join(', ');
                            const fullArtistText = f.artist + (featNames ? ` feat. ${featNames}` : '');

                            return (
                                <div
                                    key={f.id}
                                    onContextMenu={(e) => handleTrackContextMenu(e, f)}
                                    className="group grid gap-4 px-4 py-2.5 items-center hover:bg-accent/25 rounded-md transition-colors text-sm w-full"
                                    style={{ gridTemplateColumns }}
                                >
                                    <div className="text-center text-fg-muted flex justify-center">
                                        <span className="group-hover:hidden tabular-nums">{i + 1}</span>
                                        <Tooltip content={`Играть ${f.title} от ${fullArtistText}`}>
                                            <button className="hidden group-hover:flex items-center justify-center w-full" onClick={() => play(f as any)}>
                                                <PlayIcon className="size-4 text-fg" />
                                            </button>
                                        </Tooltip>
                                    </div>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="size-11 bg-bg-elevated rounded overflow-hidden shrink-0">
                                            {f.coverUrl ? <img src={f.coverUrl} className="size-full object-cover" alt="" /> : <div className="size-full flex items-center justify-center bg-accent/5"><MusicIcon className="size-5 text-fg-muted/40" /></div>}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <Tooltip content={f.title}>
                                                <Link to={`/tracks/${f.id}`} className="truncate text-fg font-bold hover:underline">
                                                    <HighlightedText text={f.title} query={searchQuery} />
                                                </Link>
                                            </Tooltip>
                                            <div className="truncate text-xs text-fg-muted mt-0.5">
                                                <Tooltip content={fullArtistText}>
                                                    <span>
                                                        <Link to={`/artists/${f.artistId}`} className="hover:text-fg hover:underline">
                                                            <HighlightedText text={f.artist || 'Неизвестный'} query={searchQuery} />
                                                        </Link>
                                                        {trackAny.featuredArtists?.length > 0 && (
                                                            <>
                                                                {', feat. '}
                                                                {trackAny.featuredArtists.map((fa: any, idx: number) => (
                                                                    <span key={fa.id}>
                                                                        {idx > 0 && ', '}
                                                                        <Link to={`/artists/${fa.id}`} className="hover:text-fg hover:underline">
                                                                            <HighlightedText text={fa.name} query={searchQuery} />
                                                                        </Link>
                                                                    </span>
                                                                ))}
                                                            </>
                                                        )}
                                                    </span>
                                                </Tooltip>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="truncate text-fg-muted">
                                        {trackAny.albumTitle ? (
                                            <Tooltip content={trackAny.albumTitle}>
                                                <Link to={`/albums/${trackAny.albumId}`} className="hover:underline hover:text-fg">
                                                    <HighlightedText text={trackAny.albumTitle} query={searchQuery} />
                                                </Link>
                                            </Tooltip>
                                        ) : '-'}
                                    </div>
                                    <div className="truncate text-fg-muted">{new Date(f.likedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                    <div className="flex items-center justify-end gap-3 text-fg-muted pr-2">
                                        <button onClick={() => unlike.mutate({ trackId: f.id, nextLiked: false })} className="opacity-0 group-hover:opacity-100 text-accent transition-all hover:scale-110">
                                            <HeartIcon filled className="size-4" />
                                        </button>
                                        <span className="w-10 text-right tabular-nums">{formatDuration(trackAny.duration)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <ContextMenuPortal isOpen={isOpen} position={position}>
                {contextTrack && (
                    <>
                        <ContextMenuSub label="Добавить в плейлист" icon={<PlusIcon className="size-4" />}>
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

                                {filteredPlaylists.map((p) => (
                                    <ContextMenuItem
                                        key={p.id}
                                        disabled={addTrackToPlaylist.isPending}
                                        onClick={() => addTrackToPlaylist.mutate(p.id)}
                                    >
                                        {p.title}
                                    </ContextMenuItem>
                                ))}
                            </div>
                        </ContextMenuSub>

                        <ContextMenuItem
                            danger
                            icon={<HeartIcon className="size-4" filled={false} />}
                            onClick={() => { unlike.mutate({ trackId: contextTrack.id, nextLiked: false }); close(); }}
                        >
                            Убрать из избранного
                        </ContextMenuItem>

                        <ContextMenuItem
                            icon={<DownloadIcon className="size-4" />}
                            disabled={offline.busy}
                            onClick={() => {
                                if (offline.cached) {
                                    offline.remove();
                                } else {
                                    offline.add();
                                }
                                close();
                            }}
                        >
                            {offline.cached ? 'Убрать из офлайн' : 'Доступно офлайн'}
                        </ContextMenuItem>
                    </>
                )}
            </ContextMenuPortal>
        </div>
    );
}