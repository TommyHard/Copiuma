import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { unreadCount } from '@/shared/api/notifications';
import { Tooltip } from '@/shared/ui/Tooltip';
import { cn } from '@/shared/lib/cn';
import { BellIcon } from '@/shared/ui/icons';

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