import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { unreadCount } from '@/shared/api/notifications';

/**
 * Уведомления(колокольчик) в шапке. Цифра обновляется:
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
        <Link
            to="/notifications"
            className="relative inline-flex size-9 items-center justify-center rounded-md hover:bg-bg-elevated"
            aria-label={`Уведомления${n > 0 ? `, новых ${n}` : ''}`}
            title="Уведомления"
        >
            <span aria-hidden>🔔</span>
            {n > 0 && (
                <span className="absolute -right-1 -top-1 flex min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {n > 99 ? '99+' : n}
                </span>
            )}
        </Link>
    );
}