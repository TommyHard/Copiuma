import { useEffect, useRef, useState } from 'react';
import { currentTrackSelector, usePlayer } from './store';
import { HlsAudio } from './HlsAudio';
import { hlsMasterUrl } from '@/shared/api/catalog';
import { reportPlayEvent } from '@/shared/api/tracks';
import { useToggleTrackLike } from '@/features/track/useToggleTrackLike';
import { Tooltip } from '@/shared/ui/Tooltip';
import { PlayIcon, HeartIcon, QueueIcon } from '@/shared/ui/icons';
import { Link } from 'react-router-dom';
import { useUIStore } from '@/shared/store/uiStore';
import { getTrackStatus } from '@/shared/api/catalog';
import { cn } from '@/shared/lib/cn';

interface PlaySession {
    trackId: string;
    startMs: number | null;
    accumulated: number;
}

function flushSession(session: PlaySession | null, completed: boolean) {
    if (!session) return;
    let total = session.accumulated;
    if (session.startMs !== null) total += Date.now() - session.startMs;
    if (total >= 1000) {
        void reportPlayEvent(session.trackId, total, completed).catch(() => { });
        session.accumulated = 0;
        session.startMs = null;
    }
}

// SVG

const PauseIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
    </svg>
);

const PrevIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <rect x="6" y="5.5" width="3" height="13" rx="1.5" />
        <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 7L11 12l6 5z" />
    </svg>
);

const NextIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
        <rect x="15" y="5.5" width="3" height="13" rx="1.5" />
        <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 7l6 5-6 5z" />
    </svg>
);

const ShuffleIcon = ({ active }: { active: boolean }) => (
    <div className="relative flex items-center justify-center w-6 h-6">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M 3 18 h 4 c 3 0, 4 -12, 7 -12 h 7" />
            <path d="M 17 2 l 4 4 l -4 4" />

            <path d="M 3 6 h 4 c 1.5 0, 2 1.5, 3 4" />
            <path d="M 11 14 c 1 2.5, 1.5 4, 3 4 h 7" />
            <path d="M 17 14 l 4 4 l -4 4" />
        </svg>
        {active && (
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[5px] h-[5px] bg-accent rounded-full" />
        )}
    </div>
);

const RepeatIcon = ({ state }: { state: 'off' | 'all' | 'one' }) => {
    return (
        <div className="relative flex items-center justify-center w-6 h-6">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M 8 17 H 7 a 3 3 0 0 1 -3 -3 V 9 a 3 3 0 0 1 3 -3 h 10 a 3 3 0 0 1 3 3 v 5 a 3 3 0 0 1 -3 3 H 12" />
                <path d="M 15 14 l -3 3 l 3 3" />
                {state === 'one' && (
                    <>
                        <text x="12" y="9" textAnchor="middle" stroke="rgb(var(--bg))" strokeWidth="4" strokeLinejoin="round" fill="rgb(var(--bg))" fontSize="10" fontWeight="bold">
                            1
                        </text>
                        <text x="12" y="8" textAnchor="middle" stroke="none" fill="currentColor" fontSize="9" fontWeight="bold">
                            1
                        </text>
                    </>
                )}
            </svg>
            {state !== 'off' && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[5px] h-[5px] bg-accent rounded-full" />
            )}
        </div>
    );
};

const CoverPlaceholderIcon = () => (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 opacity-50">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19.5V5.625c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v11.25m-12 3c0 1.242-1.008 2.25-2.25 2.25S5.25 20.742 5.25 19.5s1.008-2.25 2.25-2.25 2.25 1.008 2.25 2.25zm12 0c0 1.242-1.008 2.25-2.25 2.25s-2.25-1.008-2.25-2.25 1.008-2.25 2.25-2.25 2.25 1.008 2.25 2.25z" />
    </svg>
);

const VolumeIcon = ({ volume }: { volume: number }) => {
    if (volume === 0) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
        );
    }
    if (volume < 0.33) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            </svg>
        );
    }
    if (volume < 0.66) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
        );
    }
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
        </svg>
    );
};

export function LikeButton({
    isLiked,
    onClick
}: {
    isLiked: boolean;
    onClick: () => void;
}) {
    const [likePop, setLikePop] = useState(false);

    useEffect(() => {
        setLikePop(false);
    }, [isLiked]);

    const handleClick = () => {
        if (!isLiked) {
            setLikePop(false);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setLikePop(true));
            });
        }
        onClick();
    };

    return (
        <div className="relative flex items-center justify-center shrink-0 ml-1">
            <style>{`
            @keyframes particle-explode {
                0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0); opacity: 0; }
            }
        `}</style>

            <Tooltip content={isLiked ? "Убрать из избранных" : "Добавить в избранные"}>
                <button
                    onClick={handleClick}
                    className={cn(
                        "transition-transform duration-300 hover:scale-110 active:scale-90 relative z-20",
                        isLiked ? "text-accent" : "text-fg-muted hover:text-fg"
                    )}
                >
                    <HeartIcon filled={isLiked} />
                </button>
            </Tooltip>

            {likePop && (
                <div className="absolute inset-0 pointer-events-none z-10">
                    {[...Array(6)].map((_, i) => {
                        const angle = (i * 60 * Math.PI) / 180;
                        const tx = Math.cos(angle) * 24;
                        const ty = Math.sin(angle) * 24;
                        return (
                            <div
                                key={i}
                                className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-accent rounded-full"
                                style={{
                                    '--tx': `${tx}px`,
                                    '--ty': `${ty}px`,
                                    animation: 'particle-explode 0.5s cubic-bezier(0.1, 0.8, 0.3, 1) forwards'
                                } as React.CSSProperties}
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function CustomSlider({
    value,
    max,
    onChange,
    ariaLabel,
    tooltipFormatter
}: {
    value: number,
    max: number,
    onChange: (v: number) => void,
    ariaLabel?: string,
    tooltipFormatter?: (val: number, max: number) => string
}) {
    const percent = max > 0 ? (value / max) * 100 : 0;

    return (
        <div className="group relative flex w-full items-center h-4 cursor-pointer">
            <input
                type="range"
                min={0}
                max={max}
                step="any"
                value={value}
                onChange={(e) => onChange(parseFloat(e.target.value))}
                className="peer absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                aria-label={ariaLabel}
            />

            {tooltipFormatter && (
                <div
                    className="absolute bottom-full mb-1.5 -translate-x-1/2 px-1.5 py-0.5 bg-bg-elevated border border-border text-[10px] text-fg font-medium rounded opacity-0 peer-hover:opacity-100 peer-focus-visible:opacity-100 peer-active:opacity-100 transition-opacity pointer-events-none shadow-sm whitespace-nowrap z-50"
                    style={{ left: `${percent}%` }}
                >
                    {tooltipFormatter(value, max)}
                </div>
            )}

            <div className="absolute -inset-x-1 inset-y-1.5 pointer-events-none rounded-[2px] opacity-0 peer-focus-visible:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-accent peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-bg-elevated transition-opacity z-0" />

            <div className="absolute w-full h-1 bg-fg/10 rounded-full overflow-hidden pointer-events-none z-0">
                <div
                    className="h-full bg-fg peer-hover:bg-accent transition-colors duration-200"
                    style={{ width: `${percent}%` }}
                />
            </div>

            <div
                className="absolute h-3 w-3 rounded-full bg-white opacity-0 peer-hover:opacity-100 peer-focus-visible:opacity-100 transition-opacity duration-200 shadow-md border border-black/10 pointer-events-none z-10"
                style={{ left: `calc(${percent}% - 6px)` }}
            />
        </div>
    );
}

export function Player() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const hlsRef = useRef<HlsAudio | null>(null);
    const sessionRef = useRef<PlaySession | null>(null);
    const isPlayingRef = useRef(false);

    const track = usePlayer(currentTrackSelector);
    const isPlaying = usePlayer((s) => s.isPlaying);
    const volume = usePlayer((s) => s.volume);
    const muted = usePlayer((s) => s.muted);
    const position = usePlayer((s) => s.position);
    const duration = usePlayer((s) => s.duration);
    const seekRequest = usePlayer((s) => s.seekRequest);

    const togglePlay = usePlayer((s) => s.togglePlay);
    const next = usePlayer((s) => s.next);
    const prev = usePlayer((s) => s.prev);
    const setPosition = usePlayer((s) => s.setPosition);
    const setDuration = usePlayer((s) => s.setDuration);
    const seek = usePlayer((s) => s.seek);
    const setVolume = usePlayer((s) => s.setVolume);
    const toggleMute = usePlayer((s) => s.toggleMute);

    const likeApi = useToggleTrackLike();

    const { isRightOpen, rightTab, setRightTab, setRightOpen } = useUIStore();
    const updateTrackState = usePlayer(s => s.updateTrackState);
    const isQueueActive = isRightOpen && rightTab === 'queue';

    const toggleQueue = () => {
        if (!isRightOpen) {
            setRightOpen(true);
            setRightTab('queue');
        } else {
            setRightTab(rightTab === 'queue' ? 'now-playing' : 'queue');
        }
    };

    const [repeatState, setRepeatState] = useState<'off' | 'all' | 'one'>('off');
    const [isShuffle, setIsShuffle] = useState(false);
    const [showRemaining, setShowRemaining] = useState(false);
    const [isLiked, setIsLiked] = useState(false);

    useEffect(() => {
        setIsLiked(track?.isLikedByMe ?? false);
    }, [track?.id, track?.isLikedByMe]);

    const handleRepeatClick = () => {
        setRepeatState(prev => prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off');
    };

    const handleLikeClick = () => {
        if (!track) return;
        const nextLiked = !isLiked;
        setIsLiked(nextLiked);
        likeApi.mutate({ trackId: track.id, nextLiked });
        updateTrackState(track.id, { isLikedByMe: nextLiked });
    };

    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    useEffect(() => {
        const s = sessionRef.current;
        if (!s) return;
        if (isPlaying && s.startMs === null) {
            s.startMs = Date.now();
        } else if (!isPlaying && s.startMs !== null) {
            s.accumulated += Date.now() - s.startMs;
            s.startMs = null;
            flushSession(s, false);
        }
    }, [isPlaying]);

    useEffect(() => {
        flushSession(sessionRef.current, false);
        sessionRef.current = track
            ? { trackId: track.id, startMs: isPlayingRef.current ? Date.now() : null, accumulated: 0 }
            : null;
    }, [track?.id]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            flushSession(sessionRef.current, false);
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            flushSession(sessionRef.current, false);
        };
    }, []);

    useEffect(() => {
        if (!audioRef.current) return;
        if (!hlsRef.current) hlsRef.current = new HlsAudio(audioRef.current);

        let cancelled = false;

        const prepareHls = async () => {
            if (!track) {
                hlsRef.current?.detach();
                return;
            }
            try {
                const st = await getTrackStatus(track.id);
                if (cancelled) return;

                if (st.status === 'Ready') {
                    hlsRef.current?.load(hlsMasterUrl(track.id));
                } else {
                    console.warn("Трек не готов, пропускаем...");
                    next();
                }
            } catch (e) {
                if (cancelled) return;
                console.error("Ошибка загрузки трека (404), пропускаем...", e);
                next();
            }
        };

        prepareHls();

        return () => { cancelled = true; };
    }, [track?.id]);

    useEffect(() => {
        const a = audioRef.current;
        if (!a || !track) return;
        if (isPlaying) {
            void a.play().catch(() => {
                usePlayer.setState({ isPlaying: false });
            });
        } else {
            a.pause();
        }
    }, [isPlaying, track?.id]);

    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;
        a.volume = volume;
        a.muted = muted;
    }, [volume, muted]);

    useEffect(() => {
        if (!seekRequest || !audioRef.current) return;
        const audio = audioRef.current;
        const value = seekRequest.value;

        const apply = () => {
            try {
                audio.currentTime = value;
            } catch { }
        };

        if (audio.readyState >= 1) {
            apply();
            return;
        }

        const onMeta = () => {
            apply();
            audio.removeEventListener('loadedmetadata', onMeta);
        };
        audio.addEventListener('loadedmetadata', onMeta);
        return () => audio.removeEventListener('loadedmetadata', onMeta);
    }, [seekRequest]);

    if (!track) {
        return (
            <div className="bg-transparent px-6 py-2 flex items-center justify-between gap-6 opacity-30 pointer-events-none select-none">
                <div className="flex items-center gap-4 w-1/3 min-w-[180px] -translate-y-[5px]">
                    <div className="w-16 h-16 bg-bg-elevated rounded-md shrink-0 flex items-center justify-center">
                        <CoverPlaceholderIcon />
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold truncate text-fg">Нет трека</span>
                        <span className="text-xs text-fg-muted truncate">—</span>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center w-full max-w-2xl">
                    <div className="flex items-center gap-6 mb-1 -translate-y-[5px]">
                        <Tooltip content="Случайный порядок">
                            <button className="relative text-fg-muted">
                                <ShuffleIcon active={false} />
                            </button>
                        </Tooltip>

                        <Tooltip content="Предыдущий">
                            <button className="relative text-fg-muted">
                                <PrevIcon />
                            </button>
                        </Tooltip>

                        <Tooltip content="Играть">
                            <button className="relative flex items-center justify-center w-9 h-9 bg-white text-black rounded-full shadow-sm">
                                <PlayIcon />
                            </button>
                        </Tooltip>

                        <Tooltip content="Следующий">
                            <button className="relative text-fg-muted">
                                <NextIcon />
                            </button>
                        </Tooltip>

                        <Tooltip content="Повтор">
                            <button className="relative text-fg-muted">
                                <RepeatIcon state="off" />
                            </button>
                        </Tooltip>
                    </div>
                    <div className="flex items-center gap-3 w-full text-xs text-fg-muted font-medium tabular-nums -translate-y-[5px]">
                        <span className="w-10 text-right">-:-</span>
                        <CustomSlider value={0} max={1} onChange={() => { }} />
                        <span className="w-10 text-left">-:-</span>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-3 w-1/3 min-w-[150px] pr-[25px] -translate-y-[5px]">
                    <Tooltip content="Выключить звук">
                        <button className="relative text-fg-muted">
                            <VolumeIcon volume={1} />
                        </button>
                    </Tooltip>
                    <div className="w-24">
                        <CustomSlider
                            value={0}
                            max={1}
                            onChange={() => { }}
                            tooltipFormatter={(v) => Math.round(v * 100).toString()}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-transparent px-6 py-2 flex items-center justify-between gap-6">

            {/* ЛЕВАЯ ЧАСТЬ: Обложка, Инфо, Heart */}
            <div className="flex items-center gap-4 w-1/3 min-w-[200px] -translate-y-[5px]">
                <Link to={`/tracks/${track.id}`} className="shrink-0 flex">
                    <div
                        className="w-16 h-16 bg-bg-elevated rounded-md flex items-center justify-center text-fg-muted shadow-sm bg-cover bg-center overflow-hidden"
                        style={{ backgroundImage: track.coverUrl ? `url(${track.coverUrl})` : undefined }}
                    >
                        {!track.coverUrl && <CoverPlaceholderIcon />}
                    </div>
                </Link>

                <div className="flex flex-col min-w-0 pr-2">
                    <Link
                        to={`/tracks/${track.id}`}
                        className="text-sm font-semibold truncate text-fg hover:underline cursor-pointer"
                    >
                        {track.title}
                    </Link>
                    <div className="text-xs text-fg-muted truncate">
                        {track.artistId ? (
                            <Link
                                to={`/artists/${track.artistId}`}
                                className="hover:text-fg hover:underline cursor-pointer"
                            >
                                {track.artist ?? 'Неизвестный исполнитель'}
                            </Link>
                        ) : (
                            <span>
                                {track.artist ?? 'Неизвестный исполнитель'}
                            </span>
                        )}
                        {track.featuredArtists && track.featuredArtists.length > 0 && (
                            <span>
                                {', feat. '}
                                {track.featuredArtists.map((fa, idx) => (
                                    <span key={fa.id}>
                                        {idx > 0 && ', '}
                                        <Link
                                            to={`/artists/${fa.id}`}
                                            className="hover:text-fg hover:underline cursor-pointer"
                                        >
                                            {fa.name}
                                        </Link>
                                    </span>
                                ))}
                            </span>
                        )}
                    </div>
                </div>

                <LikeButton
                    isLiked={isLiked}
                    onClick={handleLikeClick}
                />
            </div>

            {/* ЦЕНТРАЛЬНАЯ ЧАСТЬ: Кнопки и ProgressBar */}
            <div className="flex flex-col items-center justify-center w-full max-w-2xl">

                <div className="flex items-center gap-6 mb-1 -translate-y-[8px]">
                    <Tooltip content={isShuffle ? 'Случайный порядок включен' : 'Случайный порядок выключен'}>
                        <button
                            onClick={() => setIsShuffle(!isShuffle)}
                            className={`relative transition-transform duration-200 hover:scale-105 active:scale-100 ${isShuffle ? 'text-accent' : 'text-fg-muted hover:text-fg'}`}
                        >
                            <ShuffleIcon active={isShuffle} />
                        </button>
                    </Tooltip>

                    <Tooltip content="Предыдущий">
                        <button
                            onClick={prev}
                            className="relative text-fg-muted hover:text-fg transition-transform duration-200 hover:scale-105 active:scale-100"
                        >
                            <PrevIcon />
                        </button>
                    </Tooltip>

                    <Tooltip content={isPlaying ? 'Пауза' : 'Играть'}>
                        <button
                            onClick={togglePlay}
                            className="relative flex items-center justify-center w-9 h-9 bg-white text-black rounded-full shadow-sm transition-transform duration-200 hover:scale-105 active:scale-100"
                        >
                            {isPlaying ? <PauseIcon /> : <PlayIcon />}
                        </button>
                    </Tooltip>

                    <Tooltip content="Следующий">
                        <button
                            onClick={next}
                            className="relative text-fg-muted hover:text-fg transition-transform duration-200 hover:scale-105 active:scale-100"
                        >
                            <NextIcon />
                        </button>
                    </Tooltip>

                    <Tooltip content={repeatState === 'off' ? 'Повтор выключен' : repeatState === 'all' ? 'Повтор плейлиста' : 'Повтор трека'}>
                        <button
                            onClick={handleRepeatClick}
                            className={`relative transition-transform duration-200 hover:scale-105 active:scale-100 ${repeatState !== 'off' ? 'text-accent' : 'text-fg-muted hover:text-fg'}`}
                        >
                            <RepeatIcon state={repeatState} />
                        </button>
                    </Tooltip>
                </div>

                <div className="flex items-center gap-3 w-full text-xs text-fg-muted font-medium tabular-nums -translate-y-[2px]">
                    <span className="w-10 text-right">{formatTime(position)}</span>
                    <CustomSlider
                        value={position}
                        max={duration || 0}
                        onChange={seek}
                        ariaLabel="Позиция воспроизведения"
                    />

                    <Tooltip content={showRemaining ? "Показать общую длительность" : "Показать оставшееся время"}>
                        <span
                            className="relative w-10 text-left cursor-pointer hover:text-fg transition-colors select-none"
                            onClick={() => setShowRemaining(!showRemaining)}
                        >
                            {showRemaining
                                ? `-${formatTime(Math.max(0, duration - position))}`
                                : formatTime(duration)}
                        </span>
                    </Tooltip>
                </div>
            </div>

            {/* ПРАВАЯ ЧАСТЬ: Volume */}
            <div className="flex items-center justify-end gap-2 w-1/3 min-w-[150px] pr-[25px] -translate-y-[5px]">

                <Tooltip content="Очередь">
                    <button
                        onClick={toggleQueue}
                        className={cn(
                            "relative transition-transform duration-200 hover:scale-105 active:scale-100 mr-2",
                            isQueueActive ? "text-accent" : "text-fg-muted hover:text-fg"
                        )}
                    >
                        <QueueIcon />
                        {isQueueActive && (
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-[5px] h-[5px] bg-accent rounded-full" />
                        )}
                    </button>
                </Tooltip>

                <Tooltip content={muted ? 'Включить' : 'Выключить'}>
                    <button
                        onClick={toggleMute}
                        className="relative text-fg-muted hover:text-fg transition-transform duration-200 hover:scale-105 active:scale-100"
                    >
                        <VolumeIcon volume={muted ? 0 : volume} />
                    </button>
                </Tooltip>
                <div className="w-24">
                    <CustomSlider
                        value={muted ? 0 : volume}
                        max={1}
                        onChange={setVolume}
                        ariaLabel="Громкость"
                        tooltipFormatter={(v) => Math.round(v * 100).toString()}
                    />
                </div>
            </div>

            <audio
                ref={audioRef}
                onTimeUpdate={(e) => setPosition((e.target as HTMLAudioElement).currentTime)}
                onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
                onEnded={() => {
                    flushSession(sessionRef.current, true);
                    sessionRef.current = null;

                    if (repeatState === 'one') {
                        if (audioRef.current) {
                            audioRef.current.currentTime = 0;
                            audioRef.current.play();
                        }
                    } else {
                        next();
                    }
                }}
                preload="metadata"
                playsInline
                className="hidden"
            />
        </div>
    );
}

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}