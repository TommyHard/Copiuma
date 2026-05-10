import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getTrack, getTrackStatus } from '@/shared/api/catalog';
import { deleteTrack, deleteTrackCover, uploadTrackCover } from '@/shared/api/tracks';
import { setLyrics, deleteLyrics, getLyrics } from '@/shared/api/lyrics';
import { useToggleTrackLike } from '@/features/track/useToggleTrackLike';
import { dislikeTrack } from '@/shared/api/dislikes';
import { similarTracks } from '@/shared/api/recommendations';
import { listGenres } from '@/shared/api/genres';
import { usePlayTrack } from '@/features/player/usePlayTrack';
import { usePlayer } from '@/features/player/store';
import { Waveform } from '@/features/track/Waveform';
import { TrackRow } from './track-row';
import { useAuth } from '@/features/auth/useAuth';
import { StarRating } from '@/features/ratings/StarRating';
import { Reviews } from '@/features/reviews/Reviews';
import { ReportButton, ReportButtonRef } from '@/features/reports/ReportButton';
import { TrackEditDialog } from '@/features/track/TrackEditDialog';
import { useToggleOfflineForTrack } from './OfflinePage';
import { useAverageColor } from '@/shared/hooks/useAverageColor';
import { Tooltip } from '@/shared/ui/Tooltip';
import {
    MusicIcon, PlayIcon, HeartIcon, DislikeIcon,
    CheckIcon, TrashIcon, RefreshIcon, SettingsIcon, DownloadIcon,
    FlagIcon,
    LyricsIcon,
    PencilIcon
} from '@/shared/ui/icons';
import { NowPlayingBadge } from '@/features/player/NowPlayingBadge';
import { cn } from '@/shared/lib/cn';

export function TrackPage() {
    const { id } = useParams();
    const qc = useQueryClient();
    const navigate = useNavigate();
    const play = usePlayTrack();
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const lyricsInputRef = useRef<HTMLInputElement>(null);

    const reportRef = useRef<ReportButtonRef>(null);

    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteLyricsOpen, setDeleteLyricsOpen] = useState(false);
    const [deleteCoverOpen, setDeleteCoverOpen] = useState(false);

    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (menuRef.current?.contains(target) || menuBtnRef.current?.contains(target)) return;
            setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    const lyricsQ = useQuery({
        queryKey: ['lyrics', id],
        queryFn: () => getLyrics(id!),
        enabled: !!id,
        staleTime: 60_000,
    });
    const hasLyrics = !!lyricsQ.data;
    const [scrollY, setScrollY] = useState(0);
    const pageRef = useRef<HTMLDivElement>(null);

    const trackQ = useQuery({
        queryKey: ['track', id],
        queryFn: () => getTrack(id!),
        enabled: !!id,
    });

    const statusQ = useQuery({
        queryKey: ['track-status', id],
        queryFn: () => getTrackStatus(id!),
        enabled: !!id,
        refetchInterval: (query) => (query.state.data?.status === 'Ready' ? false : 3000),
    });

    const similarQ = useQuery({
        queryKey: ['similar', id],
        queryFn: () => similarTracks(id!, 10),
        enabled: !!id && statusQ.data?.status === 'Ready',
    });

    const genresQ = useQuery({
        queryKey: ['genres'],
        queryFn: listGenres,
        staleTime: 10 * 60 * 1000,
    });

    const like = useToggleTrackLike();
    const coverColor = useAverageColor(trackQ.data?.coverUrl);

    const remove = useMutation({
        mutationFn: () => deleteTrack(id!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['catalog'] });
            qc.invalidateQueries({ queryKey: ['favorites'] });
            navigate('/catalog');
        },
    });

    const dislike = useMutation({
        mutationFn: () => dislikeTrack(id!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['recommendations'] });
            qc.invalidateQueries({ queryKey: ['for-you'] });
        },
    });

    const offline = useToggleOfflineForTrack(id ?? '');

    useEffect(() => {
        const scrollContainer = document.getElementById('main-scroll-container');
        if (!scrollContainer) return;

        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    setScrollY(scrollContainer.scrollTop);
                    ticking = false;
                });
                ticking = true;
            }
        };

        handleScroll();

        scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, []);

    if (trackQ.isLoading) return <div className="p-8 text-fg-muted animate-pulse">Загружаем…</div>;
    if (trackQ.isError || !trackQ.data) return <div className="p-8 text-danger">Трек не найден.</div>;

    const t = trackQ.data;
    const activeCoverUrl = t.ownCoverUrl || t.coverUrl;
    const ready = statusQ.data?.status === 'Ready';
    const isOwner = !!user && !!t.uploadedByUserId && user.id === t.uploadedByUserId;
    const gradientBaseColor = coverColor || 'var(--accent-color, rgba(0, 0, 0, 0.5))';

    const genreLabel = (slug: string) =>
        genresQ.data?.find((g) => g.slug === slug)?.displayName ?? slug;

    const BANNER_HEIGHT = 450;
    const bannerScale = Math.max(1, 1.1 - (scrollY / BANNER_HEIGHT) * 0.7);
    const colorOverlayOpacity = Math.min(1, (scrollY / BANNER_HEIGHT) * 3);
    const isStickyVisible = scrollY > BANNER_HEIGHT;


    return (
        <div ref={pageRef} className="relative flex flex-col min-h-full pb-32">

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        const { coverUrl } = await uploadTrackCover(t.id, file);
                        qc.setQueryData<any>(['track', id], (prev: any) => prev ? {
                            ...prev,
                            coverUrl,
                            ownCoverUrl: coverUrl,
                            hasOwnCover: true,
                        } : prev);
                        usePlayer.getState().updateTrackState(t.id, { coverUrl });
                        qc.invalidateQueries({ queryKey: ['track', id] });
                        qc.invalidateQueries({ queryKey: ['catalog'] });
                        qc.invalidateQueries({ queryKey: ['playlist'] });
                        qc.invalidateQueries({ queryKey: ['album-tracks'] });
                        e.target.value = '';
                    }
                }}
            />

            <input
                type="file"
                ref={lyricsInputRef}
                className="hidden"
                accept=".lrc,.txt,text/plain"
                onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 64 * 1024) {
                        alert('Файл слишком большой (макс. 64KB).');
                        return;
                    }
                    const text = await file.text();
                    await setLyrics(t.id, text);
                    qc.invalidateQueries({ queryKey: ['lyrics', id] });
                    e.target.value = '';
                }}
            />

            {/* STICKY HEADER */}
            <div className="sticky top-0 z-50 w-full h-0 pointer-events-none">
                <div
                    className={cn(
                        "absolute top-0 left-0 w-full h-[70px] flex items-center px-8 transition-all duration-500 pointer-events-auto",
                        isStickyVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full"
                    )}
                    style={{ backgroundColor: gradientBaseColor }}
                >
                    <div className="flex flex-col">
                        <span className="text-lg font-black text-white leading-none">
                            {t.title} {t.isExplicit && <span className="text-[10px] bg-white/20 px-1 rounded ml-2">E</span>}
                        </span>
                        <span className="text-sm text-white/80 font-medium">
                            {t.artist}
                        </span>
                    </div>
                </div>
            </div>

            {/* BANNER */}
            <div className="relative h-[450px] w-full shrink-0 overflow-hidden bg-bg border-b border-black">
                <div
                    className="absolute inset-0 origin-center blur-md transform-gpu"
                    style={{
                        transform: `scale(${bannerScale})`,
                        backgroundImage: activeCoverUrl
                            ? `url("${activeCoverUrl.replace(/"/g, '\\"')}")`
                            : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        willChange: 'transform, filter',
                    }}
                />
                <div
                    className="absolute inset-0 transition-colors duration-700"
                    style={{
                        backgroundColor: gradientBaseColor,
                        opacity: colorOverlayOpacity
                    }}
                />

                {isOwner && t.hasOwnCover && (
                    <div className="absolute top-6 left-6 z-30 px-2 py-1 rounded border border-black/50 bg-black/40">
                        <p className="text-[14px] text-white font-bold tracking-widest">Собственная обложка</p>
                    </div>
                )}

                <div className="absolute bottom-20 left-6 md:left-12 right-6 flex flex-col md:flex-row items-end gap-8 z-10">
                    <div className="shrink-0 shadow-2xl rounded-lg overflow-hidden bg-bg-elevated">
                        <div className="size-48 md:size-64 relative group">
                            {activeCoverUrl ? (
                                <img src={activeCoverUrl} alt={t.title} className="h-full w-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-accent/10 text-accent/40">
                                    <MusicIcon className="size-20" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 space-y-6 text-white drop-shadow-2xl">
                        {/* Waveform */}
                        <div className="w-full max-w-2xl">
                            {ready && id && (
                                <Waveform trackId={id} className="w-full h-14 opacity-100" />
                            )}
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest opacity-100">
                                <span>Трек</span>
                                {t.isExplicit && (
                                    <>
                                        <span>•</span>
                                        <span className="px-1.5 py-0.5 rounded bg-white/50 border border-elevated text-[10px]">Explicit</span>
                                    </>
                                )}
                            </div>
                            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-none flex items-center gap-3 flex-wrap">
                                <span>{t.title}</span>
                                <NowPlayingBadge trackId={t.id} className="scale-150 origin-left" />
                            </h1>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg font-bold">
                            <Link to={`/artists/${t.artistId}`} className="hover:underline">
                                {t.artist ?? '—'}
                            </Link>

                            {t.featuredArtists && t.featuredArtists.length > 0 && (
                                <span>
                                    feat.{' '}
                                    {t.featuredArtists.map((fa, idx) => (
                                        <span key={fa.id}>
                                            {idx > 0 && ', '}
                                            <Link to={`/artists/${fa.id}`} className="hover:underline">
                                                {fa.name}
                                            </Link>
                                        </span>
                                    ))}
                                </span>
                            )}

                            {t.albumId && (
                                <>
                                    <span>•</span>
                                    <Link to={`/albums/${t.albumId}`} className="hover:underline">
                                        {t.albumTitle}
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* GENRES INSIDE BANNER (BOTTOM) */}
                {t.genres && t.genres.length > 0 && (
                    <div className="absolute bottom-0 left-0 w-full p-6 flex flex-wrap items-center gap-2 bg-gradient-to-t from-black/40 to-transparent overflow-x-auto whitespace-nowrap scrollbar-hide">
                        {t.genres.slice(0, t.genres.length > 5 ? 4 : 5).map((slug) => (
                            <span key={slug} className="px-3 py-1 rounded bg-black/40 text-[10px] font-black uppercase tracking-widest text-white">
                                {genreLabel(slug)}
                            </span>
                        ))}

                        {t.genres.length > 5 && (
                            <Tooltip
                                position="top"
                                content={
                                    <div className="flex flex-col gap-1.5 p-1">
                                        {t.genres.slice(4).map((slug) => (
                                            <span key={slug} className="text-[11px] uppercase font-bold text-fg">
                                                {genreLabel(slug)}
                                            </span>
                                        ))}
                                    </div>
                                }
                            >
                                <span className="px-3 py-1 rounded bg-black/40 hover:bg-black/60 transition-colors text-[10px] font-black uppercase tracking-widest text-white cursor-help">
                                    Ещё {t.genres.length - 4}...
                                </span>
                            </Tooltip>
                        )}
                    </div>
                )}
            </div>

            {/* GRADIENT BELOW BANNER */}
            <div
                className="absolute left-0 w-full pointer-events-none transition-colors duration-500"
                style={{
                    top: '450px',
                    height: '250px',
                    background: `linear-gradient(to bottom, ${gradientBaseColor} 0%, transparent 100%)`,
                    opacity: 0.4
                }}
            />

            <div className="px-6 md:px-12 pt-10 relative z-10 space-y-16">

                {/* ACTION BAR */}
                <div className="flex flex-wrap items-center gap-4">
                    <button
                        disabled={!ready}
                        onClick={() => play(
                            {
                                id: t.id, title: t.title, artist: t.artist, duration: t.duration,
                                uploadedAt: '', artistId: t.artistId, albumId: t.albumId,
                                trackNumber: t.trackNumber, isExplicit: t.isExplicit, coverUrl: t.coverUrl
                            },
                            { context: { type: 'track' } }
                        )}
                        className="h-14 px-5 rounded font-black uppercase tracking-widest bg-accent text-white shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-3"
                    >
                        {ready ? <><PlayIcon className="size-6" /> Играть</> : <><RefreshIcon className="size-6 animate-spin" /> Обработка… </>}
                    </button>

                    <Tooltip content={t.isLikedByMe ? "Убрать из избранного" : "В избранное"} position="top">
                        <button
                            onClick={() => like.mutate({ trackId: t.id, nextLiked: !t.isLikedByMe })}
                            disabled={like.isPending}
                            className={cn(
                                "size-14 flex items-center justify-center rounded transition-all hover:scale-105 shadow-sm",
                                t.isLikedByMe ? "bg-accent text-white hover:bg-accent/90" : "bg-bg-elevated text-fg hover:bg-fg/10"
                            )}
                        >
                            <HeartIcon filled className={cn("size-7", t.isLikedByMe ? "" : "opacity-80")} />
                        </button>
                    </Tooltip>

                    <div className="flex-1" />

                    <div className="flex items-center gap-2">

                        {/* SETTINGS MENU */}
                        <div className="relative">
                            <Tooltip content="Опции" position="top">
                                <button
                                    ref={menuBtnRef}
                                    onClick={() => setMenuOpen(!menuOpen)}
                                    className="size-14 flex items-center justify-center rounded transition-all text-fg hover:bg-accent/20"
                                >
                                    <SettingsIcon className="w-7 h-7" />
                                </button>
                            </Tooltip>

                            {menuOpen && (
                                <div
                                    ref={menuRef}
                                    className="absolute top-full right-0 mt-2 z-[9999] w-64 rounded-md border border-border bg-bg-elevated shadow-xl p-1 animate-in fade-in zoom-in-95"
                                >
                                    <button
                                        onClick={() => { offline.cached ? offline.remove() : offline.add(); setMenuOpen(false); }}
                                        disabled={offline.busy || !ready}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-fg/10 rounded flex items-center gap-2 text-fg disabled:opacity-50"
                                    >
                                        {offline.cached ? <CheckIcon className="size-4" /> : <DownloadIcon className="size-4" />}
                                        {offline.cached ? 'Удалить из офлайна' : 'Сохранить в офлайн'}
                                    </button>

                                    <div className="h-px bg-border my-1" />

                                    {!isOwner && (
                                        <>
                                            <button
                                                onClick={() => { dislike.mutate(); setMenuOpen(false); }}
                                                disabled={dislike.isPending || dislike.isSuccess}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 text-sm hover:bg-fg/10 rounded flex items-center gap-2 text-fg transition-colors",
                                                    dislike.isSuccess && "opacity-50 line-through"
                                                )}
                                            >
                                                <DislikeIcon className="size-4" /> Не интересно
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setMenuOpen(false);
                                                    reportRef.current?.open();
                                                }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-danger/10 text-danger rounded flex items-center gap-2 transition-colors"
                                            >
                                                <FlagIcon className="size-4" /> Пожаловаться
                                            </button>
                                        </>
                                    )}

                                    {isOwner && (
                                        <>
                                            <button
                                                onClick={() => { fileInputRef.current?.click(); setMenuOpen(false); }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-fg/10 rounded flex items-center gap-2 text-fg"
                                            >
                                                {t.hasOwnCover ? <DownloadIcon className="size-4" /> : <DownloadIcon className="size-4 rotate-180" />}
                                                {t.hasOwnCover ? 'Заменить обложку' : 'Загрузить обложку'}
                                            </button>
                                            {t.hasOwnCover && (
                                                <button
                                                    onClick={() => {
                                                        setMenuOpen(false);
                                                        setDeleteCoverOpen(true);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-danger/10 text-danger rounded flex items-center gap-2"
                                                >
                                                    Убрать обложку
                                                </button>
                                            )}

                                            <div className="h-px bg-border my-1" />

                                            <button
                                                onClick={() => { lyricsInputRef.current?.click(); setMenuOpen(false); }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-fg/10 rounded flex items-center gap-2 text-fg"
                                            >
                                                <LyricsIcon className="size-4" /> {hasLyrics ? 'Заменить .lrc-файл' : 'Загрузить .lrc-файл'}
                                            </button>
                                            {hasLyrics && (
                                                <button
                                                    onClick={() => {
                                                        setMenuOpen(false);
                                                        setDeleteLyricsOpen(true);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-danger/10 text-danger rounded flex items-center gap-2"
                                                >
                                                    <TrashIcon className="size-4" /> Удалить текст песни
                                                </button>
                                            )}

                                            <div className="h-px bg-border my-1" />

                                            <button
                                                onClick={() => { setEditOpen(true); setMenuOpen(false); }}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-fg/10 rounded flex items-center gap-2 text-fg"
                                            >
                                                <PencilIcon /> Редактировать
                                            </button>
                                            <button
                                                onClick={() => { setDeleteOpen(true); setMenuOpen(false); }}
                                                disabled={remove.isPending}
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-danger/10 text-danger rounded flex items-center gap-2 disabled:opacity-50"
                                            >
                                                <TrashIcon className="size-4" /> Удалить трек
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <ReportButton ref={reportRef} targetType="Track" targetId={t.id} />

                <div className="grid grid-cols-1 gap-16">
                    <div className="space-y-16">
                        {ready && id && (
                            <section className="space-y-6">
                                <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
                                    Оценка
                                </h2>

                                <div className="bg-bg-elevated border border-border rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center gap-4 text-center max-w-2xl">
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-fg">Оцените трек</h3>
                                        <p className="text-sm text-fg-muted max-w-sm mx-auto">
                                            Ваша оценка помогает нам точнее подбирать музыку для вас и других слушателей.
                                        </p>
                                    </div>
                                    <div className="bg-bg p-4 rounded-xl border border-border shadow-inner mt-2">
                                        <StarRating trackId={id} />
                                    </div>
                                </div>
                            </section>
                        )}

                        {ready && id && (
                            <section className="space-y-6">
                                <Reviews trackId={id} />
                            </section>
                        )}
                    </div>

                    <section className="space-y-6 pt-10 border-t border-border">
                        <h2 className="text-3xl font-black tracking-tight">Похожие треки</h2>
                        {similarQ.data && similarQ.data.length > 0 ? (
                            <div className="rounded border border-border bg-bg-elevated/20 backdrop-blur-sm overflow-hidden">
                                {similarQ.data.map((s, i) => (
                                    <TrackRow
                                        key={s.id}
                                        track={s}
                                        playList={similarQ.data!}
                                        playListIndex={i}
                                        playListContext={{ type: 'queue' }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-fg-muted italic">Похожих треков пока нет</p>
                        )}
                    </section>
                </div>
            </div>

            {isOwner && (
                <TrackEditDialog
                    open={editOpen}
                    track={t}
                    onClose={() => setEditOpen(false)}
                />
            )}

            {isOwner && (
                <ConfirmDialog
                    open={deleteOpen}
                    title="Удалить трек?"
                    description="Вы уверены, что хотите безвозвратно удалить этот трек? Это действие нельзя отменить."
                    onClose={() => setDeleteOpen(false)}
                    onConfirm={() => remove.mutate()}
                    isPending={remove.isPending}
                />
            )}

            {isOwner && (
                <ConfirmDialog
                    open={deleteCoverOpen}
                    title="Удалить обложку?"
                    description="Вы уверены, что хотите удалить собственную обложку?"
                    onClose={() => setDeleteCoverOpen(false)}
                    onConfirm={async () => {
                        await deleteTrackCover(t.id);
                        qc.invalidateQueries({ queryKey: ['track', id] });
                        setDeleteCoverOpen(false);
                    }}
                />
            )}

            {isOwner && (
                <ConfirmDialog
                    open={deleteLyricsOpen}
                    title="Удалить текст песни?"
                    description="Вы уверены, что хотите удалить текст этой песни?"
                    onClose={() => setDeleteLyricsOpen(false)}
                    onConfirm={async () => {
                        await deleteLyrics(t.id);
                        qc.invalidateQueries({ queryKey: ['lyrics', id] });
                        setDeleteLyricsOpen(false);
                    }}
                />
            )}
        </div>
    );
}

function ConfirmDialog({
    open,
    title,
    description,
    onClose,
    onConfirm,
    isPending
}: {
    open: boolean;
    title: string;
    description: string;
    onClose: () => void;
    onConfirm: () => void;
    isPending?: boolean;
}) {
    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-bg-elevated border border-border rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4">
                <h2 className="text-xl font-bold text-fg">{title}</h2>
                <p className="text-fg-muted">{description}</p>

                <div className="flex justify-end gap-3 mt-4">
                    <button
                        onClick={onClose}
                        disabled={isPending}
                        className="px-4 py-2 rounded-md bg-bg hover:bg-fg/10 text-fg font-medium transition-colors"
                    >
                        Отмена
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isPending}
                        className="px-4 py-2 rounded-md bg-danger hover:bg-danger/90 text-white font-medium transition-colors flex items-center gap-2"
                    >
                        {isPending && <RefreshIcon className="size-4 animate-spin" />}
                        Удалить
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}