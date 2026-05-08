import { usePlayer, isPlayingFromContext, isActivelyPlayingFrom, type PlaybackContext } from './store';
import { cn } from '@/shared/lib/cn';

/**
 * Значок как в спотике
 * - active=false  -> ничего не рисует
 * - paused=true   -> аним. замирает
 */
export function PlayingBars({ className, paused }: { className?: string; paused?: boolean }) {
    return (
        <span className={cn("inline-flex items-end gap-[2px] h-3 align-middle", className)} aria-hidden>
            <style>{`
                @keyframes nowPlayingBar {
                    0%   { transform: scaleY(0.35); }
                    50%  { transform: scaleY(1); }
                    100% { transform: scaleY(0.55); }
                }
            `}</style>
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="inline-block w-[3px] bg-accent rounded-md origin-bottom"
                    style={{
                        height: '100%',
                        animation: paused ? 'none' : `nowPlayingBar ${0.7 + i * 0.15}s ease-in-out ${i * 0.1}s infinite alternate`,
                        transform: paused ? 'scaleY(0.5)' : undefined,
                    }}
                />
            ))}
        </span>
    );
}

/**
 * Бадж "Сейчас играет" для коллекции (плейлист/альбом/артист/Избранное etc.)
 *
 * Если очередь плеера была загружена ИЗ этого источника — показывает либо
 * анимированные палочки (когда трек реально играет), либо приглушённую иконку паузы
 */
export function NowPlayingFromBadge({
    target,
    className,
    label,
}: {
    target: PlaybackContext;
    className?: string;
    label?: boolean;
}) {
    const isFrom = usePlayer((s) => isPlayingFromContext(s, target));
    const isActive = usePlayer((s) => isActivelyPlayingFrom(s, target));
    if (!isFrom) return null;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest",
                isActive ? "text-accent" : "text-fg-muted",
                className,
            )}
        >
            <PlayingBars paused={!isActive} />
            {label && <span>{isActive ? 'Сейчас играет' : 'На паузе'}</span>}
        </span>
    );
}

/**
 * Возвращает true, если КОНКРЕТНЫЙ трек сейчас в очереди и активно играет
 */
export function useIsTrackPlaying(trackId: string): { isCurrent: boolean; isPlaying: boolean } {
    const isCurrent = usePlayer((s) => {
        const cur = s.index >= 0 ? s.queue[s.index] : null;
        return cur?.id === trackId;
    });
    const isPlaying = usePlayer((s) => s.isPlaying);
    return { isCurrent, isPlaying: isCurrent && isPlaying };
}