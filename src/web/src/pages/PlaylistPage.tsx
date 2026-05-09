import { useState, useRef, useEffect, KeyboardEvent, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import {
    deletePlaylist,
    getPlaylist,
    leavePlaylist,
    removeMember,
    removeTrack,
    renamePlaylist,
    reorderTracks,
    setVisibility,
    listPlaylists,
    addTrack,
    getPlaylistsContainingTrack
} from '@/shared/api/playlists';
import { useAuth } from '@/features/auth/useAuth';
import { usePlayer } from '@/features/player/store';
import { InvitePeopleDialog } from '@/features/playlists/InvitePeopleDialog';
import { PlaylistAuditLog } from '@/features/playlists/PlaylistAuditLog';
import { PlaylistCover } from '@/features/playlists/PlaylistCover';
import type { PlaylistTrack, PlaylistVisibility, UserSearchResult } from '@/shared/types';
import { useToggleTrackLike } from '@/features/track/useToggleTrackLike';
import { usePlayTrack } from '@/features/player/usePlayTrack';
import { batchUsers } from '@/shared/api/users';
import { cn } from '@/shared/lib/cn';
import { Tooltip } from '@/shared/ui/Tooltip';
import { useContextMenu, ContextMenuPortal, ContextMenuItem, ContextMenuSub, ContextMenuSeparator } from '@/shared/ui/ContextMenu';
import {
    PlayIcon, HeartIcon, PlusIcon, SearchIcon, MusicIcon, CheckIcon, ClockIcon,
    LockIcon, GlobeIcon, EyeOffIcon, DragHandleIcon, TrashIcon, MoreHorizontalIcon,
    PencilIcon, LogOutIcon,
    UsersIcon, SettingsIcon
} from '@/shared/ui/icons';
import { UserAvatar } from '@/shared/ui/UserAvatar';

const ROLE_TRANSLATIONS: Record<string, string> = {
    Owner: 'Владелец',
    Editor: 'Редактор',
    Viewer: 'Зритель'
};

export function PlaylistPage() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const qc = useQueryClient();
    const playQueue = usePlayer((s) => s.playQueue);
    const playTrack = usePlayTrack();
    const toggleLike = useToggleTrackLike();

    const [inviteOpen, setInviteOpen] = useState(false);

    const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
    const [visibilityCoords, setVisibilityCoords] = useState({ top: 0, left: 0, width: 0 });
    const visibilityBtnRef = useRef<HTMLButtonElement>(null);

    const [renaming, setRenaming] = useState(false);
    const [titleDraft, setTitleDraft] = useState('');
    const [isDragMode, setIsDragMode] = useState(false);
    const [localOrder, setLocalOrder] = useState<string[] | null>(null);
    const dragId = useRef<string | null>(null);
    const dragOverId = useRef<string | null>(null);

    const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
    const optionsMenuRef = useRef<HTMLDivElement>(null);
    const optionsMenuBtnRef = useRef<HTMLButtonElement>(null);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

    const q = useQuery({
        queryKey: ['playlist', id],
        queryFn: () => getPlaylist(id!),
        enabled: !!id,
    });

    const removeT = useMutation({
        mutationFn: (trackId: string) => removeTrack(id!, trackId),
        onSuccess: () => {
            setLocalOrder(null);
            qc.invalidateQueries({ queryKey: ['playlist', id] });
        },
    });

    const reorder = useMutation({
        mutationFn: (ids: string[]) => reorderTracks(id!, ids),
        onSuccess: () => {
            setLocalOrder(null);
            qc.invalidateQueries({ queryKey: ['playlist', id] });
        },
    });

    const visibility = useMutation({
        mutationFn: (v: PlaylistVisibility) => setVisibility(id!, v),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['playlist', id] }),
    });

    const removeM = useMutation({
        mutationFn: (userId: string) => removeMember(id!, userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['playlist', id] }),
    });

    const leave = useMutation({
        mutationFn: () => leavePlaylist(id!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['playlists'] });
            navigate('/playlists');
        },
    });

    const remove = useMutation({
        mutationFn: () => deletePlaylist(id!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['playlists'] });
            navigate('/playlists');
        },
    });

    const rename = useMutation({
        mutationFn: (title: string) => renamePlaylist(id!, title),
        onSuccess: () => {
            setRenaming(false);
            qc.invalidateQueries({ queryKey: ['playlist', id] });
            qc.invalidateQueries({ queryKey: ['playlists'] });
        },
    });

    function startRename(currentTitle: string) {
        setTitleDraft(currentTitle);
        setRenaming(true);
    }

    function commitRename() {
        const next = titleDraft.trim();
        if (!next || !q.data || next === q.data.title) {
            setRenaming(false);
            return;
        }
        rename.mutate(next);
    }

    function onTitleKey(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
        else if (e.key === 'Escape') { e.preventDefault(); setRenaming(false); }
    }

    const memberIds = q.data?.members?.map((m) => m.userId) ?? [];
    const memberNamesQ = useQuery({
        queryKey: ['user-names', ...memberIds.sort()],
        queryFn: () => batchUsers(memberIds),
        enabled: memberIds.length > 0,
    });

    const memberNameMap: Record<string, UserSearchResult> = {};
    for (const u of memberNamesQ.data ?? []) memberNameMap[u.id] = u;

    const { isOpen, position, onContextMenu, close } = useContextMenu();
    const [contextTrack, setContextTrack] = useState<PlaylistTrack | null>(null);
    const [playlistSearch, setPlaylistSearch] = useState('');

    useEffect(() => {
        if (!isOpen) setPlaylistSearch('');
    }, [isOpen]);

    useEffect(() => {
        if (!optionsMenuOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (optionsMenuRef.current?.contains(target) || optionsMenuBtnRef.current?.contains(target)) return;
            setOptionsMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [optionsMenuOpen]);

    const qPlaylists = useQuery({
        queryKey: ['playlists'],
        queryFn: listPlaylists,
        enabled: isOpen,
        staleTime: 60_000,
    });

    const qContaining = useQuery({
        queryKey: ['playlists-containing', contextTrack?.trackId],
        queryFn: () => getPlaylistsContainingTrack(contextTrack!.trackId),
        enabled: isOpen && !!contextTrack?.trackId,
        staleTime: 30_000,
    });
    const containingSet = new Set(qContaining.data ?? []);

    const addTrackToPlaylist = useMutation({
        mutationFn: (playlistId: string) => addTrack(playlistId, contextTrack!.trackId),
        onSuccess: (_, playlistId) => {
            qc.invalidateQueries({ queryKey: ['playlist', playlistId] });
            qc.invalidateQueries({ queryKey: ['playlists-containing', contextTrack?.trackId] });
            close();
        },
    });

    const filteredPlaylists = qPlaylists.data?.filter(p =>
        p.title.toLowerCase().includes(playlistSearch.toLowerCase())
    ) || [];

    const handleTrackContextMenu = (e: React.MouseEvent, track: PlaylistTrack) => {
        setContextTrack(track);
        onContextMenu(e);
    };

    const openVisibilityMenu = () => {
        if (visibilityBtnRef.current) {
            const rect = visibilityBtnRef.current.getBoundingClientRect();
            setVisibilityCoords({
                top: rect.bottom + 8,
                left: rect.left,
                width: Math.max(160, rect.width)
            });
            setVisibilityMenuOpen(true);
        }
    };

    // Sticky Header
    const [isSticky, setIsSticky] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

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

    const [colWidths, setColWidths] = useState([320, 180]);
    const [activeResizer, setActiveResizer] = useState<number | null>(null);
    const [isManuallyResized, setIsManuallyResized] = useState(false);

    const COL_LIMITS = useMemo(() => [{ min: 140 }, { min: 100 }], []);

    useEffect(() => {
        const el = tableContainerRef.current;
        if (!el) return;
        const observer = new ResizeObserver((entries) => {
            const containerWidth = entries[0].contentRect.width;
            if (containerWidth === 0) return;

            setColWidths(prev => {
                const reservedSpace = 240;
                const maxAllowed = Math.max(COL_LIMITS[0].min + COL_LIMITS[1].min, containerWidth - reservedSpace);

                if (!isManuallyResized) {
                    return [Math.max(COL_LIMITS[0].min, maxAllowed * 0.6), Math.max(COL_LIMITS[1].min, maxAllowed * 0.4)];
                }
                const total = prev[0] + prev[1];
                if (total <= maxAllowed) return prev;
                const ratio = maxAllowed / total;
                return [
                    Math.max(COL_LIMITS[0].min, prev[0] * ratio),
                    Math.max(COL_LIMITS[1].min, prev[1] * ratio),
                ];
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
                const reservedSpace = 240;
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

    const gridTemplateColumns = `32px ${colWidths[0]}px ${colWidths[1]}px minmax(100px, 1fr)`;

    const rawMembers = q.data?.members || [];

    const sortedMembers = useMemo(() => {
        return [...rawMembers].sort((a, b) => {
            if (a.role === 'Owner') return -1;
            if (b.role === 'Owner') return 1;
            return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
        });
    }, [rawMembers]);

    if (q.isLoading) return (
        <div className="flex h-full items-center justify-center">
            <div className="size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
    );
    if (q.isError || !q.data) return <p className="text-danger p-6">Плейлист не найден.</p>;

    const p = q.data;
    const isOwner = !!user && user.id === p.ownerId;
    const canEdit = isOwner || (p.isCollaborative && p.members?.find(m => m.userId === user?.id)?.role === 'Editor');
    const myMember = p.members?.find((m) => m.userId === user?.id);

    const serverTracks = [...(p.tracks || [])].sort((a, b) => a.position - b.position);

    const tracks = localOrder
        ? localOrder.map(tid => serverTracks.find(t => t.trackId === tid)!).filter(Boolean)
        : serverTracks;

    function handleDragStart(trackId: string) { dragId.current = trackId; }
    function handleDragOver(e: React.DragEvent, trackId: string) { e.preventDefault(); dragOverId.current = trackId; }
    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        const from = dragId.current;
        const to = dragOverId.current;
        dragId.current = null;
        dragOverId.current = null;
        if (!from || !to || from === to) return;

        const current = localOrder ?? serverTracks.map(t => t.trackId);
        const fromIdx = current.indexOf(from);
        const toIdx = current.indexOf(to);
        const next = [...current];
        next.splice(fromIdx, 1);
        next.splice(toIdx, 0, from);
        setLocalOrder(next);
        reorder.mutate(next);
    }

    function playAll() {
        if (tracks.length === 0) return;
        playQueue(
            tracks.map((t) => ({
                id: t.trackId,
                title: t.title,
                artist: t.artist,
                duration: t.duration,
                uploadedAt: '',
                artistId: t.artistId || null,
                albumId: t.albumId || null,
                trackNumber: null,
                isExplicit: t.isExplicit,
                coverUrl: t.coverUrl
            })),
            0,
        );
    }

    return (
        <article className="relative flex flex-col min-h-full pb-32">
            {/* BANNER */}
            <div className="relative w-full shrink-0 flex flex-col md:flex-row items-start md:items-end px-6 md:px-10 py-10 gap-6 overflow-hidden bg-bg-elevated border-b border-border">
                <div className="absolute inset-0 bg-gradient-to-t from-bg-accent/50 to-bg-transparent pointer-events-none" />

                <PlaylistCover
                    coverUrl={p.coverUrl}
                    previewCovers={p.previewCovers}
                    className="size-48 md:size-56 shrink-0 shadow-2xl rounded ring-1 ring-border relative z-10"
                />

                <div className="relative z-10 flex flex-col gap-3 min-w-0 flex-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-fg-muted flex items-center gap-2">
                        Плейлист • {
                            p.visibility === 'Public' ? 'Открытый доступ' :
                                p.visibility === 'Unlisted' ? 'Доступ по ссылке' : 'Приватный'
                        }
                        {p.isCollaborative && (
                            <span className="bg-accent/20 text-accent px-2 py-0.5 rounded text-[10px] ml-1">
                                Совместный
                            </span>
                        )}
                    </span>

                    {renaming ? (
                        <div className="flex items-center gap-3 w-full">
                            <input
                                autoFocus
                                value={titleDraft}
                                onChange={(e) => setTitleDraft(e.target.value)}
                                onKeyDown={onTitleKey}
                                disabled={rename.isPending}
                                className="bg-transparent border-b-2 border-accent text-4xl md:text-6xl font-black text-fg outline-none pb-1 w-full max-w-xl"
                            />
                            <button onClick={commitRename} className="bg-accent text-accent-fg p-2 rounded hover:opacity-90">
                                <CheckIcon className="size-5" />
                            </button>
                            <button onClick={() => setRenaming(false)} className="bg-bg-elevated border border-border p-2 rounded hover:bg-fg/5 text-fg-muted">
                                <PlusIcon className="size-5 rotate-45" />
                            </button>
                        </div>
                    ) : (
                        <div className="group flex items-center gap-3">
                            <h1 className="text-4xl md:text-6xl font-black text-fg tracking-tight truncate">{p.title}</h1>
                            {isOwner && (
                                <Tooltip content="Переименовать">
                                    <button onClick={() => startRename(p.title)} className="opacity-0 group-hover:opacity-100 text-fg-muted hover:text-fg transition-opacity p-2">
                                        <PencilIcon className="size-5" />
                                    </button>
                                </Tooltip>
                            )}
                        </div>
                    )}

                    {(() => {
                        const ownerDetails = memberNameMap[p.ownerId];
                        const ownerAvatar = ownerDetails?.avatarUrl;

                        return (
                            <div className="flex items-center gap-2 text-sm text-fg font-medium mt-2">
                                <Link to={`/users/${p.ownerId}`} className="hover:underline flex items-center gap-2">
                                    <UserAvatar
                                        avatarUrl={ownerAvatar}
                                        displayName={p.ownerName || ownerDetails?.displayName || 'П'}
                                        size={24}
                                        showIconFallback={!p.ownerName && !ownerDetails?.displayName}
                                    />
                                    {p.ownerName || 'Пользователь'}
                                </Link>
                                <span className="text-fg-muted">•</span>
                                <span className="text-fg-muted">{p.trackCount ?? 0} треков</span>
                                {rename.isError && <span className="text-danger text-xs ml-2">Ошибка сохранения</span>}
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* TOOLBAR */}
            <div className="flex items-center gap-4 px-6 md:px-10 py-6 relative z-20 w-full flex-wrap">
                {tracks.length > 0 && (
                    <Tooltip content="Играть всё">
                        <button
                            onClick={playAll}
                            className="h-14 px-5 rounded font-black uppercase tracking-widest bg-accent text-white shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3"
                        >
                            <PlayIcon className="size-6" /> Играть
                        </button>
                    </Tooltip>
                )}

                <div className="flex-1" />

                {canEdit && (
                    <div className="relative">
                        <Tooltip content="Опции" position="top">
                            <button
                                ref={optionsMenuBtnRef}
                                onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
                                className="size-14 flex items-center justify-center rounded transition-all text-fg hover:bg-accent/20"
                            >
                                <SettingsIcon className="w-7 h-7" />
                            </button>
                        </Tooltip>

                        {optionsMenuOpen && (
                            <div
                                ref={optionsMenuRef}
                                className="absolute top-full right-0 mt-2 z-[9999] w-64 rounded-md border border-border bg-bg-elevated shadow-xl p-1 animate-in fade-in zoom-in-95"
                            >
                                <button
                                    onClick={() => {
                                        setIsDragMode(!isDragMode);
                                        setOptionsMenuOpen(false);
                                    }}
                                    className={cn(
                                        "w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition-colors",
                                        isDragMode ? "bg-accent/10 text-accent" : "hover:bg-fg/10 text-fg"
                                    )}
                                >
                                    <DragHandleIcon className="size-4" />
                                    {isDragMode ? "Готово (Порядок)" : "Изменить порядок"}
                                </button>

                                {isOwner && (
                                    <>
                                        <div className="h-px bg-border my-1" />

                                        <button
                                            ref={visibilityBtnRef}
                                            onClick={() => {
                                                openVisibilityMenu();
                                                setOptionsMenuOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition-colors hover:bg-fg/10 text-fg"
                                        >
                                            {p.visibility === 'Public' && <GlobeIcon className="size-4 text-fg-muted" />}
                                            {p.visibility === 'Unlisted' && <EyeOffIcon className="size-4 text-fg-muted" />}
                                            {p.visibility === 'Private' && <LockIcon className="size-4 text-fg-muted" />}
                                            Доступность ({p.visibility})
                                        </button>

                                        <button
                                            onClick={() => {
                                                setInviteOpen(true);
                                                setOptionsMenuOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition-colors hover:bg-fg/10 text-fg"
                                        >
                                            <PlusIcon className="size-4 text-fg-muted" />
                                            Пригласить
                                        </button>

                                        <div className="h-px bg-border my-1" />

                                        <button
                                            onClick={() => {
                                                setIsConfirmDeleteOpen(true);
                                                setOptionsMenuOpen(false);
                                            }}
                                            disabled={remove.isPending}
                                            className="w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 transition-colors hover:bg-danger/10 text-danger disabled:opacity-50"
                                        >
                                            <TrashIcon className="size-4" />
                                            Удалить плейлист
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {!isOwner && myMember && (
                    <button
                        onClick={() => leave.mutate()}
                        disabled={leave.isPending}
                        className="flex items-center gap-2 rounded border border-border px-4 py-2 text-sm font-medium hover:bg-danger/10 hover:text-danger hover:border-transparent transition-colors"
                    >
                        <LogOutIcon className="size-4" />
                        Покинуть
                    </button>
                )}
            </div>

            {/* TRACKS */}
            <div className="px-6 md:px-10 pb-10 w-full">
                <div ref={tableContainerRef} className="w-full">
                    <div ref={sentinelRef} className="w-full h-px pointer-events-none -mb-px" />
                    <div
                        className={cn(
                            "group sticky top-0 z-30 grid gap-4 px-4 py-2 border-b text-sm font-bold tracking-tight uppercase w-full transition-all duration-300 text-fg-muted",
                            isSticky
                                ? "bg-bg-elevated border-border"
                                : "bg-transparent border-border/50"
                        )}
                        style={{ gridTemplateColumns }}
                    >
                        <div className="text-center">#</div>

                        <div className="relative flex items-center">
                            <span>Название</span>
                            <div
                                onMouseDown={(e) => handleResizeMouseDown(0, e)}
                                onDoubleClick={() => setIsManuallyResized(false)}
                                className={cn("absolute -right-3 top-0 bottom-0 w-6 cursor-col-resize z-40 flex justify-center items-center transition-opacity", activeResizer === 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                            >
                                <div className={cn("w-[2px] h-[60%] rounded transition-colors", activeResizer === 0 ? "bg-accent h-[80%]" : "bg-border hover:bg-accent")} />
                            </div>
                        </div>

                        <div className="relative flex items-center">
                            <span>Альбом</span>
                            <div
                                onMouseDown={(e) => handleResizeMouseDown(1, e)}
                                onDoubleClick={() => setIsManuallyResized(false)}
                                className={cn("absolute -right-3 top-0 bottom-0 w-6 cursor-col-resize z-40 flex justify-center items-center transition-opacity", activeResizer === 1 ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
                            >
                                <div className={cn("w-[2px] h-[60%] rounded transition-colors", activeResizer === 1 ? "bg-accent h-[80%]" : "bg-border hover:bg-accent")} />
                            </div>
                        </div>

                        <div className="flex justify-end pr-2">
                            <ClockIcon className="size-4" />
                        </div>
                    </div>

                    <div className="flex flex-col w-full mt-2">
                        {tracks.map((t, index) => {
                            const trackAny = t as any;
                            const featNames = trackAny.featuredArtists?.map((fa: any) => fa.name).join(', ');
                            const fullArtistText = t.artist + (featNames ? ` feat. ${featNames}` : '');
                            const trackCover = trackAny.coverUrl;
                            const albumTitle = trackAny.albumTitle;
                            const albumId = trackAny.albumId;

                            const trackForPlayer = {
                                id: t.trackId,
                                title: t.title,
                                artist: t.artist,
                                artistId: t.artistId || null,
                                duration: t.duration,
                                uploadedAt: '',
                                albumId: albumId || null,
                                trackNumber: null,
                                isExplicit: t.isExplicit,
                                coverUrl: trackCover
                            };

                            return (
                                <div
                                    key={t.trackId}
                                    draggable={canEdit && isDragMode}
                                    onDragStart={() => handleDragStart(t.trackId)}
                                    onDragOver={(e) => handleDragOver(e, t.trackId)}
                                    onDrop={handleDrop}
                                    onContextMenu={(e) => handleTrackContextMenu(e, t)}
                                    className={cn(
                                        "group grid gap-4 px-4 py-2.5 items-center hover:bg-accent/10 rounded transition-colors text-sm w-full",
                                        canEdit && isDragMode && "cursor-grab active:cursor-grabbing border border-transparent hover:border-accent/20 bg-accent/5 my-1"
                                    )}
                                    style={{ gridTemplateColumns }}
                                >
                                    <div className="flex justify-center items-center text-fg-muted">
                                        {canEdit && isDragMode ? (
                                            <DragHandleIcon className="size-5 text-fg-muted/50 hover:text-fg-muted" />
                                        ) : (
                                            <>
                                                <span className="group-hover:hidden tabular-nums">{index + 1}</span>
                                                <Tooltip content="Играть">
                                                    <button
                                                        className="hidden group-hover:flex items-center justify-center w-full"
                                                        onClick={() => playTrack(trackForPlayer as any, {
                                                            queue: tracks.map((tt) => ({
                                                                id: tt.trackId,
                                                                title: tt.title,
                                                                artist: tt.artist,
                                                                artistId: tt.artistId || null,
                                                                duration: tt.duration,
                                                                uploadedAt: '',
                                                                albumId: (tt as any).albumId || null,
                                                                trackNumber: null,
                                                                isExplicit: tt.isExplicit,
                                                                coverUrl: (tt as any).coverUrl,
                                                                isLikedByMe: tt.isLikedByMe,
                                                                featuredArtists: (tt as any).featuredArtists,
                                                            })),
                                                            startIndex: index,
                                                            context: id ? { type: 'playlist', id } : undefined,
                                                        })}
                                                    >
                                                        <PlayIcon className="size-4 text-fg" />
                                                    </button>
                                                </Tooltip>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="size-10 bg-bg-elevated rounded overflow-hidden shrink-0 border border-border/50">
                                            {trackCover ? (
                                                <img src={trackCover} className="size-full object-cover" alt="" />
                                            ) : (
                                                <div className="size-full flex items-center justify-center bg-accent/5">
                                                    <MusicIcon className="size-5 text-fg-muted/40" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <Tooltip content={t.title}>
                                                <Link to={`/tracks/${t.trackId}`} className="truncate text-[18px] font-medium hover:underline">
                                                    {t.title}
                                                </Link>
                                            </Tooltip>
                                            <div className="truncate text-[14px] text-fg-muted mt-0.5">
                                                <Tooltip content={fullArtistText}>
                                                    <span>
                                                        <Link to={`/artists/${t.artistId}`} className="hover:text-fg hover:underline">
                                                            {t.artist || 'Неизвестный'}
                                                        </Link>
                                                        {trackAny.featuredArtists && trackAny.featuredArtists.length > 0 && (
                                                            <>
                                                                {', feat. '}
                                                                {trackAny.featuredArtists.map((fa: any, idx: number) => (
                                                                    <span key={fa.id}>
                                                                        {idx > 0 && ', '}
                                                                        <Link to={`/artists/${fa.id}`} className="hover:text-fg hover:underline">
                                                                            {fa.name}
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

                                    <div className="truncate text-fg-muted text-sm">
                                        {albumTitle ? (
                                            <Tooltip content={albumTitle}>
                                                <Link to={`/albums/${albumId}`} className="hover:underline hover:text-fg">
                                                    {albumTitle}
                                                </Link>
                                            </Tooltip>
                                        ) : '-'}
                                    </div>

                                    <div className="flex items-center justify-end gap-2 text-fg-muted pr-2">
                                        <Tooltip content={t.isLikedByMe ? "Убрать из избранного" : "В избранное"}>
                                            <button
                                                onClick={() => toggleLike.mutate({ trackId: t.trackId, nextLiked: !t.isLikedByMe })}
                                                className={cn(
                                                    "opacity-0 group-hover:opacity-100 p-2 transition-transform hover:scale-110",
                                                    t.isLikedByMe ? "text-accent opacity-100" : "hover:text-fg"
                                                )}
                                            >
                                                <HeartIcon filled={!!t.isLikedByMe} className="size-4" />
                                            </button>
                                        </Tooltip>

                                        <span className="w-10 text-right tabular-nums text-sm font-medium">{formatDuration(t.duration)}</span>

                                        <Tooltip content="Действия">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleTrackContextMenu(e, t);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-fg transition-colors ml-1"
                                            >
                                                <MoreHorizontalIcon className="size-5" />
                                            </button>
                                        </Tooltip>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* MEMBERS, AUDIT */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 px-6 md:px-10">
                <section className="space-y-4">
                    <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                        <UsersIcon className="size-5 text-accent" />
                        Участники
                    </h2>
                    <ul className="flex flex-col gap-2">
                        {sortedMembers.map((m) => {
                            const userDetails = memberNameMap[m.userId];
                            const displayName = userDetails?.displayName || (m.userId === user?.id ? (user.displayName ?? user.email) : null) || m.displayName || m.userId.slice(0, 8);
                            const avatarUrl = userDetails?.avatarUrl || (m as any).avatarUrl;
                            const translatedRole = ROLE_TRANSLATIONS[m.role] || m.role;

                            return (
                                <li key={m.userId} className="group flex items-center justify-between p-3 rounded bg-bg-elevated border border-border/50 hover:border-border transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <UserAvatar avatarUrl={avatarUrl} displayName={displayName} size={40} />
                                        <div className="min-w-0">
                                            <Link to={`/users/${m.userId}`} className="block truncate font-medium text-fg hover:text-accent transition-colors text-sm">
                                                {displayName}
                                            </Link>
                                            <div className="text-xs text-fg-muted mt-0.5 font-medium">
                                                {translatedRole} • с {new Date(m.joinedAt).toLocaleDateString('ru')}
                                            </div>
                                        </div>
                                    </div>
                                    {isOwner && m.role !== 'Owner' && (
                                        <Tooltip content="Исключить">
                                            <button
                                                onClick={() => removeM.mutate(m.userId)}
                                                disabled={removeM.isPending}
                                                className="opacity-0 group-hover:opacity-100 rounded p-2 text-fg-muted hover:bg-danger/10 hover:text-danger transition-colors disabled:opacity-50"
                                            >
                                                <LogOutIcon className="size-4" />
                                            </button>
                                        </Tooltip>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>

                {myMember && p.isCollaborative && (
                    <section className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                                <ClockIcon className="size-5 text-accent" />
                                История изменений
                            </h2>
                            <Tooltip content="Доступно только участникам плейлиста">
                                <span className="text-xs px-2.5 py-1 bg-accent/10 text-accent rounded font-medium flex items-center gap-1.5 cursor-help">
                                    <LockIcon className="size-3" />
                                    Для участников
                                </span>
                            </Tooltip>
                        </div>
                        <div className="rounded border border-border bg-bg-elevated shadow-sm">
                            <PlaylistAuditLog playlistId={p.id} />
                        </div>
                    </section>
                )}
            </div>

            {/* MODALS */}

            <ConfirmDialog
                isOpen={isConfirmDeleteOpen}
                title="Удалить плейлист"
                message="Вы уверены, что хотите удалить этот плейлист безвозвратно? Это действие нельзя будет отменить."
                confirmText="Удалить"
                cancelText="Отмена"
                danger={true}
                onConfirm={() => {
                    remove.mutate();
                    setIsConfirmDeleteOpen(false);
                }}
                onCancel={() => setIsConfirmDeleteOpen(false)}
            />

            {visibilityMenuOpen && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setVisibilityMenuOpen(false)} />
                    <div
                        className="fixed z-[9999] bg-bg-elevated border border-border rounded shadow-xl py-1 flex flex-col animate-in fade-in zoom-in-95"
                        style={{ top: visibilityCoords.top, left: visibilityCoords.left, minWidth: visibilityCoords.width }}
                    >
                        {(['Private', 'Unlisted', 'Public'] as PlaylistVisibility[]).map((v) => (
                            <button
                                key={v}
                                onClick={() => {
                                    visibility.mutate(v);
                                    setVisibilityMenuOpen(false);
                                }}
                                className={cn(
                                    "flex items-center gap-2 text-left px-3 py-2 text-sm transition-colors rounded mx-1",
                                    p.visibility === v ? "bg-accent/10 text-accent" : "text-fg hover:bg-fg/10"
                                )}
                            >
                                {v === 'Public' && <GlobeIcon className="size-4" />}
                                {v === 'Unlisted' && <EyeOffIcon className="size-4" />}
                                {v === 'Private' && <LockIcon className="size-4" />}
                                {v}
                            </button>
                        ))}
                    </div>
                </>,
                document.body
            )}

            {isOwner && id && (
                <InvitePeopleDialog
                    open={inviteOpen}
                    playlistId={id}
                    onClose={() => setInviteOpen(false)}
                />
            )}

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
                                        className="w-full bg-bg border border-border rounded pl-8 pr-3 py-1 text-xs text-fg focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                            </div>
                            <ContextMenuSeparator />
                            <div className="max-h-[200px] overflow-y-auto">
                                {qPlaylists.isLoading && <p className="px-3 py-2 text-xs text-fg-muted">Загрузка...</p>}
                                {qPlaylists.data && filteredPlaylists.length === 0 && <p className="px-3 py-2 text-xs text-fg-muted">Ничего не найдено</p>}
                                {filteredPlaylists.map((playlist) => {
                                    const already = containingSet.has(playlist.id);
                                    return (
                                        <ContextMenuItem
                                            key={playlist.id}
                                            disabled={addTrackToPlaylist.isPending || already}
                                            onClick={() => !already && addTrackToPlaylist.mutate(playlist.id)}
                                            icon={already ? <CheckIcon className="w-3.5 h-3.5 text-accent" /> : undefined}
                                        >
                                            {already ? `${playlist.title} • добавлен` : playlist.title}
                                        </ContextMenuItem>
                                    );
                                })}
                            </div>
                        </ContextMenuSub>

                        {canEdit && (
                            <ContextMenuItem
                                danger
                                icon={<TrashIcon className="size-4" />}
                                onClick={() => { removeT.mutate(contextTrack.trackId); close(); }}
                            >
                                Удалить из плейлиста
                            </ContextMenuItem>
                        )}
                    </>
                )}
            </ContextMenuPortal>
        </article>
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