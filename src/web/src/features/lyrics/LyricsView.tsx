import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { currentTrackSelector, usePlayer } from '@/features/player/store';
import { useUIStore } from '@/shared/store/uiStore';
import { getLyrics } from '@/shared/api/lyrics';
import { parseLrc, findActiveLineIndex, type LyricLine } from './parseLrc';
import { MusicIcon, PlusIcon } from '@/shared/ui/icons';
import { cn } from '@/shared/lib/cn';

export function LyricsView() {
    const track = usePlayer(currentTrackSelector);
    const position = usePlayer((s) => s.position);
    const seek = usePlayer((s) => s.seek);
    const setLyricsOpen = useUIStore((s) => s.setLyricsOpen);

    const lyricsQ = useQuery({
        queryKey: ['lyrics', track?.id],
        queryFn: () => getLyrics(track!.id),
        enabled: !!track?.id,
        staleTime: 60_000,
    });

    const lines: LyricLine[] = useMemo(
        () => (lyricsQ.data ? parseLrc(lyricsQ.data) : []),
        [lyricsQ.data],
    );
    const hasTimestamps = lines.length > 0;

    // Если LRC пуст - пробуем как обычный plain-text
    const plainLines = useMemo<string[]>(() => {
        if (!lyricsQ.data || hasTimestamps) return [];
        return lyricsQ.data.split(/\r?\n/).map((l) => l.trim());
    }, [lyricsQ.data, hasTimestamps]);

    const activeIndex = useMemo(
        () => (hasTimestamps ? findActiveLineIndex(lines, position) : -1),
        [lines, position, hasTimestamps],
    );

    const containerRef = useRef<HTMLDivElement | null>(null);
    const lineRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const [autoScroll, setAutoScroll] = useState(true);

    // Автоскролл к активной строке
    useEffect(() => {
        if (!autoScroll) return;
        const el = lineRefs.current[activeIndex];
        const c = containerRef.current;
        if (!el || !c) return;
        const elTop = el.offsetTop;
        const elH = el.offsetHeight;
        const cH = c.clientHeight;
        const target = elTop - cH / 2 + elH / 2;
        c.scrollTo({ top: target, behavior: 'smooth' });
    }, [activeIndex, autoScroll]);

    useEffect(() => {
        const c = containerRef.current;
        if (!c) return;
        let timer: number | null = null;
        const onScroll = () => {
            setAutoScroll(false);
            if (timer) window.clearTimeout(timer);
            timer = window.setTimeout(() => setAutoScroll(true), 4000);
        };
        let userScroll = false;
        const onUser = () => { userScroll = true; onScroll(); };
        c.addEventListener('wheel', onUser, { passive: true });
        c.addEventListener('touchmove', onUser, { passive: true });
        return () => {
            c.removeEventListener('wheel', onUser);
            c.removeEventListener('touchmove', onUser);
            if (timer) window.clearTimeout(timer);
            void userScroll;
        };
    }, []);

    return (
        <div className="absolute inset-0 z-30 flex flex-col bg-bg-elevated">
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-border">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="size-12 rounded-md bg-bg overflow-hidden shrink-0">
                        {track?.coverUrl
                            ? <img src={track.coverUrl} alt="" className="size-full object-cover" />
                            : <div className="size-full flex items-center justify-center"><MusicIcon className="opacity-40" /></div>}
                    </div>
                    <div className="min-w-0">
                        {track ? (
                            <Link to={`/tracks/${track.id}`} className="text-lg font-bold truncate hover:underline block max-w-[60vw]">
                                {track.title}
                            </Link>
                        ) : <div className="text-lg font-bold text-fg-muted">Ничего не играет</div>}
                        <div  className="text-xs text-fg-muted truncate">
                            {track && (track.artistId ? (
                                <Link to={`/artists/${track.artistId}`} className="hover:text-fg hover:underline">
                                    {track.artist ?? 'Неизвестный исполнитель'}
                                </Link>
                            ) : (
                                <span>{track.artist ?? 'Неизвестный исполнитель'}</span>
                            ))}
                            {track?.featuredArtists && track.featuredArtists.length > 0 && (
                                <span>
                                    {', feat. '}
                                    {track.featuredArtists.map((fa, idx) => (
                                        <span key={fa.id}>
                                            {idx > 0 && ', '}
                                            <Link to={`/artists/${fa.id}`} className="hover:text-fg hover:underline">
                                                {fa.name}
                                            </Link>
                                        </span>
                                    ))}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <button
                    onClick={() => setLyricsOpen(false)}
                    aria-label="Закрыть"
                    className="size-9 rounded hover:bg-fg/10 flex items-center justify-center text-fg-muted hover:text-fg transition-colors"
                >
                    <PlusIcon className="w-5 h-5 rotate-45"/>
                </button>
            </div>

            {/* Body */}
            <div ref={containerRef} className="flex-1 overflow-y-auto py-32 px-8 md:px-16 lg:px-24 space-y-6">
                {!track && (
                    <p className="text-center text-fg-muted text-lg mt-20">Включите трек, чтобы увидеть текст.</p>
                )}
                {track && lyricsQ.isLoading && (
                    <p className="text-center text-fg-muted text-lg mt-20">Загружаем текст…</p>
                )}
                {track && !lyricsQ.isLoading && !lyricsQ.data && (
                    <div className="text-center text-fg-muted text-lg mt-20 space-y-2">
                        <p>Для этого трека текст ещё не загружен.</p>
                        <p className="text-sm opacity-80">Артист может загрузить .lrc-файл на странице трека.</p>
                    </div>
                )}

                {hasTimestamps && lines.map((line, i) => {
                    const isActive = i === activeIndex;
                    const isPast = i < activeIndex;
                    return (
                        <button
                            key={`${line.time}-${i}`}
                            ref={(el) => { lineRefs.current[i] = el; }}
                            onClick={() => seek(line.time)}
                            className={cn(
                                "block w-full text-left text-2xl md:text-3xl font-bold leading-snug transition-all duration-300 cursor-pointer hover:text-fg",
                                isActive ? "text-fg scale-[1.03] origin-left" : isPast ? "text-fg-muted/50" : "text-fg-muted/80"
                            )}
                        >
                            {line.text || <span className="opacity-30">♪</span>}
                        </button>
                    );
                })}

                {!hasTimestamps && plainLines.length > 0 && (
                    <div className="text-2xl md:text-3xl font-bold leading-snug text-fg-muted whitespace-pre-wrap">
                        {plainLines.join('\n')}
                    </div>
                )}
            </div>
        </div>
    );
}