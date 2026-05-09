import { cn } from '@/shared/lib/cn';
import { UserIcon } from '@/shared/ui/icons';

/**
 * Аватар пользователя с фолбэком на инициалы / иконку.
 *
 * Использовать везде, где надо показать userAvatar
 */
export function UserAvatar({
    avatarUrl,
    displayName,
    size = 32,
    className,
    rounded = true,
    showIconFallback = false,
}: {
    avatarUrl?: string | null;
    displayName?: string | null;
    size?: number;
    className?: string;
    rounded?: boolean;
    /** UserIcon вместо инициалов когда нет аватара */
    showIconFallback?: boolean;
}) {
    const initial = (displayName || '').trim().charAt(0).toUpperCase() || '?';
    const dimension = { width: size, height: size, minWidth: size, minHeight: size };
    const radius = rounded ? 'rounded-full' : 'rounded';

    return (
        <div
            style={dimension}
            className={cn(
                'flex shrink-0 items-center justify-center overflow-hidden bg-border text-fg-muted border border-border/50',
                radius,
                className,
            )}
            aria-label={displayName ?? 'Пользователь'}
        >
            {avatarUrl ? (
                <img
                    src={avatarUrl}
                    alt=""
                    className="size-full object-cover"
                    onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                    }}
                />
            ) : showIconFallback ? (
                <UserIcon className="size-1/2 text-fg-muted" />
            ) : (
                <span
                    className="font-bold select-none"
                    style={{ fontSize: Math.max(10, Math.floor(size * 0.4)) }}
                >
                    {initial}
                </span>
            )}
        </div>
    );
}