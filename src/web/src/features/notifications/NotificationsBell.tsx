import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { unreadCount } from '@/shared/api/notifications';
import { Tooltip } from '@/shared/ui/Tooltip';
import { cn } from '@/shared/lib/cn';
import { BellIcon } from '@/shared/ui/icons';
import { useAuth } from '@/features/auth/useAuth';

/**
 * Уведомления(bell) в header. Обновляется:
 *  - запросом раз в минуту (refetchInterval)
 *  - SignalR-событием
 */
export function NotificationsBell() {
    const { user } = useAuth();
    const q = useQuery({
        queryKey: ['notifications-unread-count'],
        queryFn: unreadCount,
        refetchInterval: 60_000,
        initialData: 0,
        enabled: !!user?.id,
        retry: (count, err: any) => {
            if (err?.response?.status === 401) return false;
            return count < 2;
        },
    });

    const n = q.data ?? 0;

    return (
        <Tooltip position="bottom" content="Уведомления">
            <Link
                to="/notifications"
                className="relative inline-flex items-center justify-center p-1.5 rounded-full hover:bg-accent/20 transition-colors text-fg-muted hover:text-fg"
                aria-label={`Уведомления${n > 0 ? ', есть новые' : ''}`}
            >
                <BellIcon className="w-6 h-6" />

                {n > 0 && (
                    <span className="absolute right-2 top-0.5 flex size-2 rounded-full bg-accent ring-2 ring-bg" />
                )}
            </Link>
        </Tooltip>
    );
}