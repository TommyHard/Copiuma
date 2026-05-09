import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    deleteAlbum,
    deleteAlbumCover,
    getAlbum,
    listAlbumTracks,
    updateAlbum,
    uploadAlbumCover,
} from '@/shared/api/albums';
import { listGenres } from '@/shared/api/genres';
import { TrackRow } from './track-row';
import { usePlayer } from '@/features/player/store';
import { NowPlayingFromBadge } from '@/features/player/NowPlayingBadge';
import { useAuth } from '@/features/auth/useAuth';
import { cn } from '@/shared/lib/cn';
import type { AlbumSummary } from '@/shared/types';
import { useAlertStore } from '@/shared/store/alertStore';
import { Tooltip } from '@/shared/ui/Tooltip';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import {
    PlayIcon, ClockIcon, MusicIcon,
    TrashIcon, PencilIcon,
    SettingsIcon, DownloadIcon
} from '@/shared/ui/icons';
import { UserAvatar } from '@/shared/ui/UserAvatar';

export function AlbumPage() {
    const { id } = useParams();
    const qc = useQueryClient();
    const navigate = useNavigate();
    const { user } = useAuth();
    const playQueue = usePlayer((s) => s.playQueue);
    const showAlert = useAlertStore((s) => s.showAlert);

    const [editOpen, setEditOpen] = useState(false);
    const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [isConfirmDeleteCoverOpen, setIsConfirmDeleteCoverOpen] = useState(false);

    const optionsMenuRef = useRef<HTMLDivElement>(null);
    const optionsMenuBtnRef = useRef<HTMLButtonElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);

    const [isSticky, setIsSticky] = useState(false);

    const albumQ = useQuery({
        queryKey: ['album', id],
        queryFn: () => getAlbum(id!),
        enabled: !!id,
    });

    const tracksQ = useQuery({
        queryKey: ['album-tracks', id],
        queryFn: () => listAlbumTracks(id!),
        enabled: !!id,
    });

    const removeAlbum = useMutation({
        mutationFn: () => deleteAlbum(id!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['album', id] });
            navigate('/catalog');
        },
    });

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

    useEffect(() => {
        const sentinel = sentinelRef.current;
        const scrollContainer = document.getElementById('main-scroll-container');
        if (!sentinel || !scrollContainer) return;

        const observer = new IntersectionObserver(
            ([entry]) => setIsSticky(!entry.isIntersecting),
            { root: scrollContainer, threshold: 0, rootMargin: '-1px 0px 0px 0px' }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    }, []);

    if (albumQ.isLoading) return <div className="p-8 animate-pulse text-fg-muted">Загружаем…</div>;
    if (albumQ.isError || !albumQ.data) return <p className="text-danger p-6">Альбом не найден.</p>;

    const a = albumQ.data;
    const isOwner = !!user && !!a.ownerUserId && user.id === a.ownerUserId;
    const tracks = tracksQ.data || [];

    const handlePlayAll = () => {
        if (tracks.length > 0) {
            playQueue(tracks, 0, { type: 'album', id: id! });
        }
    };

    return (
        <article className="relative flex flex-col min-h-full pb-32">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        await uploadAlbumCover(a.id, file);
                        qc.invalidateQueries({ queryKey: ['album', a.id] });
                        setOptionsMenuOpen(false);
                    }
                }}
            />

            {/* BANNER */}
            <div className="relative w-full shrink-0 flex flex-col md:flex-row items-start md:items-end px-6 md:px-10 py-10 gap-6 overflow-hidden bg-bg-elevated border-b border-border">
                <div className="absolute inset-0 bg-gradient-to-t from-bg-accent/50 to-bg-transparent pointer-events-none" />

                <div
                    className="size-48 md:size-56 shrink-0 shadow-2xl rounded ring-1 ring-border relative z-10 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: a.coverUrl ? `url(${a.coverUrl})` : undefined }}
                >
                    {!a.coverUrl && <div className="size-full flex items-center justify-center bg-bg-elevated"><MusicIcon className="size-12 text-fg-muted/20" /></div>}
                </div>

                <div className="relative z-10 flex flex-col gap-3 min-w-0 flex-1">
                    <span className="text-xs font-bold uppercase tracking-widest text-fg-muted flex items-center gap-2">
                        Альбом
                    </span>
                    <div className="flex items-center gap-4">
                        <h1 className="text-4xl md:text-6xl font-black text-fg tracking-tight truncate">{a.title}</h1>
                        {id && <NowPlayingFromBadge target={{ type: 'album', id }} label />}
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                        <div className="flex items-center gap-2 text-sm text-fg font-medium">
                            {a.artistId ? (
                                <Link to={`/artists/${a.artistId}`} className="hover:underline font-bold flex items-center gap-2">
                                    <UserAvatar avatarUrl={a.artistAvatarUrl} displayName={a.artistName ?? 'Артист'} size={24} showIconFallback={!a.artistAvatarUrl && !a.artistName} />
                                    {a.artistName || 'Артист'}
                                </Link>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <UserAvatar avatarUrl={null} displayName="Неизвестный артист" size={24} showIconFallback />
                                    <span>Неизвестный артист</span>
                                </div>
                            )}
                            <span className="text-fg-muted">•</span>
                            <span className="text-fg-muted">{tracks.length} {pluralTracks(tracks.length)}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                            {a.releasedAt && <span>Релиз {formatDateRu(a.releasedAt)}</span>}
                            {a.createdAt && (
                                <>
                                    <span>•</span>
                                    <span>Загружен {formatDateTimeRu(a.createdAt)}</span>
                                </>
                            )}
                        </div>

                        {a.genres && a.genres.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {a.genres.map((g) => (
                                    <span key={g} className="bg-fg/5 text-fg-muted px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                        {g}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* TOOLBAR */}
            <div className="flex items-center gap-4 px-6 md:px-10 py-6 relative z-20 w-full">
                {tracks.length > 0 && (
                    <button
                        onClick={handlePlayAll}
                        className="h-14 px-5 rounded font-black uppercase tracking-widest bg-accent text-white shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                    >
                        <PlayIcon className="size-6" /> Играть
                    </button>
                )}

                <div className="flex-1" />

                {isOwner && (
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
                                    onClick={() => { fileInputRef.current?.click(); }}
                                    className="w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 hover:bg-fg/10 transition-colors"
                                >
                                    <DownloadIcon className={cn("size-4", !a.coverUrl && "rotate-180")} />
                                    {a.coverUrl ? 'Заменить обложку' : 'Загрузить обложку'}
                                </button>

                                {a.coverUrl && (
                                    <button
                                        onClick={() => {
                                            setIsConfirmDeleteCoverOpen(true);
                                            setOptionsMenuOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 hover:bg-danger/10 text-danger transition-colors"
                                    >
                                        <TrashIcon className="size-4" />
                                        Убрать обложку
                                    </button>
                                )}

                                <div className="h-px bg-border my-1" />

                                <button
                                    onClick={() => { setEditOpen(true); setOptionsMenuOpen(false); }}
                                    className="w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 hover:bg-fg/10 transition-colors"
                                >
                                    <PencilIcon className="size-4" />
                                    Редактировать
                                </button>

                                <button
                                    onClick={() => {
                                        if (!tracks || tracks.length === 0) {
                                            setIsConfirmDeleteOpen(true);
                                        } else {
                                            showAlert('Сначала открепите все треки от альбома.', 'Ошибка удаления');
                                        }
                                        setOptionsMenuOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm rounded flex items-center gap-2 hover:bg-danger/10 text-danger transition-colors"
                                >
                                    <TrashIcon className="size-4" />
                                    Удалить альбом
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* TRACKS */}
            <div className="px-6 md:px-10 pb-10 w-full">
                <div ref={tableContainerRef} className="w-full">
                    <div ref={sentinelRef} className="w-full h-px pointer-events-none -mb-px" />
                    <div
                        className={cn(
                            "sticky top-0 z-30 flex items-center gap-3 px-4 py-2 border-b text-sm font-bold tracking-tight uppercase w-full transition-all duration-300 text-fg-muted",
                            isSticky ? "bg-bg-elevated border-border shadow backdrop-blur" : "bg-transparent border-border/50"
                        )}
                    >
                        <span className="w-12 text-center">#</span>
                        <span className="flex-1">Название</span>
                        <span className="w-10 text-right pr-2"><ClockIcon className="size-4 inline-block" /></span>
                    </div>

                    <div className="flex flex-col w-full mt-2">
                        {tracks.length === 0 ? (
                            <p className="p-10 text-center text-fg-muted italic">В альбоме нет треков.</p>
                        ) : (
                            tracks.map((t, index) => (
                                <TrackRow
                                    key={t.id}
                                    track={t}
                                    number={t.trackNumber ?? index + 1}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* MODALS */}
            {isOwner && editOpen && (
                <AlbumEditDialog
                    album={a}
                    onClose={() => setEditOpen(false)}
                    onSaved={(updated) => {
                        qc.setQueryData(['album', a.id], updated);
                        qc.invalidateQueries({ queryKey: ['album', a.id] });
                        setEditOpen(false);
                    }}
                />
            )}

            <ConfirmDialog
                isOpen={isConfirmDeleteOpen}
                title="Удалить альбом"
                message={`Вы уверены, что хотите безвозвратно удалить альбом "${a.title}"?`}
                confirmText="Удалить"
                danger
                onConfirm={() => removeAlbum.mutate()}
                onCancel={() => setIsConfirmDeleteOpen(false)}
            />

            <ConfirmDialog
                isOpen={isConfirmDeleteCoverOpen}
                title="Удалить обложку"
                message="Вы уверены, что хотите удалить обложку этого альбома?"
                confirmText="Удалить"
                danger
                onConfirm={async () => {
                    await deleteAlbumCover(a.id);
                    qc.invalidateQueries({ queryKey: ['album', a.id] });
                    setIsConfirmDeleteCoverOpen(false);
                }}
                onCancel={() => setIsConfirmDeleteCoverOpen(false)}
            />
        </article>
    );
}

function formatDateRu(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTimeRu(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' });
}

function pluralTracks(n: number): string {
    const last2 = n % 100;
    const last1 = n % 10;
    if (last2 >= 11 && last2 <= 14) return 'треков';
    if (last1 === 1) return 'трек';
    if (last1 >= 2 && last1 <= 4) return 'трека';
    return 'треков';
}

function AlbumEditDialog({ album, onClose, onSaved }: { album: AlbumSummary; onClose: () => void; onSaved: (a: AlbumSummary) => void; }) {
    const [title, setTitle] = useState(album.title);
    const [releaseDate, setReleaseDate] = useState<string>(album.releasedAt ? album.releasedAt.slice(0, 10) : '');
    const [genres, setGenres] = useState<string[]>(album.genres ?? []);
    const [error, setError] = useState<string | null>(null);

    const genresQ = useQuery({ queryKey: ['genres'], queryFn: listGenres, staleTime: 10 * 60 * 1000 });
    const save = useMutation({
        mutationFn: () => updateAlbum(album.id, { title: title.trim(), releaseDate: releaseDate || null, genres }),
        onSuccess: (data) => onSaved(data),
        onError: (err: any) => setError(err?.response?.data?.message ?? 'Не удалось сохранить.'),
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-bg-elevated p-6 shadow-2xl animate-in zoom-in-95">
                <h2 className="text-xl font-bold">Редактирование альбома</h2>
                <div className="space-y-4">
                    <label className="block">
                        <span className="text-sm text-fg-muted mb-1 block">Название</span>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-2 outline-none focus:border-accent" />
                    </label>
                    <label className="block">
                        <span className="text-sm text-fg-muted mb-1 block">Дата релиза</span>
                        <input type="date" value={releaseDate} onChange={e => setReleaseDate(e.target.value)} className="w-full bg-bg border border-border rounded-lg px-3 py-2 outline-none focus:border-accent" />
                    </label>
                    <div>
                        <span className="text-sm text-fg-muted mb-2 block">Жанры</span>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                            {genresQ.data?.map(g => (
                                <button key={g.slug} type="button" onClick={() => setGenres(prev => prev.includes(g.slug) ? prev.filter(x => x !== g.slug) : [...prev, g.slug])}
                                    className={cn("px-3 py-1 rounded-full border text-xs transition-colors", genres.includes(g.slug) ? "bg-accent/20 border-accent text-accent" : "border-border text-fg-muted hover:border-fg")}>
                                    {g.displayName}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                {error && <p className="text-danger text-sm">{error}</p>}
                <div className="flex justify-end gap-3 pt-4">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium hover:bg-fg/10 rounded-lg transition-colors">Отмена</button>
                    <button type="submit" disabled={save.isPending} className="px-6 py-2 bg-accent text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                        {save.isPending ? 'Сохранение...' : 'Сохранить'}
                    </button>
                </div>
            </form>
        </div>
    );
}