import { useEffect, useRef } from 'react';
import { currentTrackSelector, usePlayer } from './store';
import { HlsAudio } from './HlsAudio';
import { hlsMasterUrl } from '@/shared/api/catalog';
import { reportPlayEvent } from '@/shared/api/tracks';
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

    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    // При изменении времени воспроизведения/паузы: обновляются метки времени сессии
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

    // При смене трека: очистить предыдущую сессию и начать новую
    useEffect(() => {
        flushSession(sessionRef.current, false);
        sessionRef.current = track
            ? { trackId: track.id, startMs: isPlayingRef.current ? Date.now() : null, accumulated: 0 }
            : null;
    }, [track?.id]);

    // При размонтировании / закрытии страницы: flush сессии
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

    // HLS lifecycle
    useEffect(() => {
        if (!audioRef.current) return;
        if (!hlsRef.current) hlsRef.current = new HlsAudio(audioRef.current);

        if (track && track.hlsReady !== false) {
            hlsRef.current.load(hlsMasterUrl(track.id));
        } else {
            hlsRef.current.detach();
        }

        return () => {
        };
    }, [track?.id, track?.hlsReady]);

    // Play/pause
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

    // Volume / mute
    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;
        a.volume = volume;
        a.muted = muted;
    }, [volume, muted]);

    // Seek
    useEffect(() => {
        if (!seekRequest || !audioRef.current) return;
        const audio = audioRef.current;
        const value = seekRequest.value;

        const apply = () => {
            try {
                audio.currentTime = value;
            } catch {
                // брувзер вернул InvalidStateError — игнорируем
            }
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
            <div className="border-t border-border bg-bg-elevated px-4 py-3 text-center text-xs text-fg-muted">
                Очередь пуста. Выбери трек на «Каталоге».
            </div>
        );
    }

    return (
        <div className="border-t border-border bg-bg-elevated/95 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{track.title}</div>
                    <div className="truncate text-xs text-fg-muted">{track.artist ?? '—'}</div>
                </div>

                <div className="flex items-center gap-2">
                    <IconButton onClick={prev} title="Предыдущий" label="⏮" />
                    <IconButton
                        onClick={togglePlay}
                        title={isPlaying ? 'Пауза' : 'Играть'}
                        label={isPlaying ? '⏸' : '▶'}
                        primary
                    />
                    <IconButton onClick={next} title="Следующий" label="⏭" />
                </div>

                <div className="hidden flex-[2] items-center gap-3 md:flex">
                    <span className="w-10 text-right text-xs tabular-nums text-fg-muted">
                        {formatTime(position)}
                    </span>
                    <input
                        type="range"
                        min={0}
                        max={duration || 0}
                        step="any"
                        value={position}
                        onChange={(e) => seek(parseFloat(e.target.value))}
                        className="flex-1 accent-accent"
                        aria-label="Позиция воспроизведения"
                    />
                    <span className="w-10 text-xs tabular-nums text-fg-muted">{formatTime(duration)}</span>
                </div>

                <div className="hidden items-center gap-2 md:flex">
                    <IconButton onClick={toggleMute} title={muted ? 'Включить' : 'Выключить'} label={muted ? '🔇' : '🔊'} />
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={muted ? 0 : volume}
                        onChange={(e) => setVolume(parseFloat(e.target.value))}
                        className="w-24 accent-accent"
                        aria-label="Громкость"
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
                    next();
                }}
                preload="metadata"
                playsInline
                className="hidden"
            />
        </div>
    );
}

function IconButton({
    onClick,
    title,
    label,
    primary,
}: {
    onClick: () => void;
    title: string;
    label: string;
    primary?: boolean;
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            className={cn(
                'flex size-9 items-center justify-center rounded-full text-base',
                primary
                    ? 'bg-accent text-accent-fg hover:opacity-90'
                    : 'text-fg-muted hover:bg-bg hover:text-fg',
            )}
        >
            {label}
        </button>
    );
}

function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}