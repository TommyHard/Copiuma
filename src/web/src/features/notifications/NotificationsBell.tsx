import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { unreadCount } from '@/shared/api/notifications';
import { Tooltip } from '@/shared/ui/Tooltip';
import { cn } from '@/shared/lib/cn';

/**
 * Уведомления(колокольчик) в header. Цифра обновляется:
 *  - запросом раз в минуту (refetchInterval)
 *  - SignalR-событием
 */
export function NotificationsBell() {
    const q = useQuery({
        queryKey: ['notifications-unread-count'],
        queryFn: unreadCount,
        refetchInterval: 60_000,
        initialData: 0,
    });

    const n = q.data ?? 0;

    const BellIcon = ({ className }: { className?: string }) => (
        <svg
            viewBox="0 0 28 28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("size-6", className)}
        >
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M14.5 18a2 2 0 0 1-4.99 0" />
        </svg>
    );

    return (
        <Tooltip position="bottom" content="Уведомления">
            <Link
                to="/notifications"
                className="relative inline-flex size-9 items-center justify-center mt-1 -translate-x-[-5px] rounded-md hover:bg-bg-elevated transition-colors text-fg-muted hover:text-fg"
                aria-label={`Уведомления${n > 0 ? ', есть новые' : ''}`}
            >
                <BellIcon />

                {n > 0 && (
                    <span className="absolute right-2 top-0.5 flex size-2 rounded-full bg-accent ring-2 ring-bg" />
                )}
            </Link>
        </Tooltip>
    );
}