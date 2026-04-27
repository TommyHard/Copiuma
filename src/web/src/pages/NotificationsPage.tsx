import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listNotifications, markAllRead, markRead } from '@/shared/api/notifications';
import type { NotificationItem } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

export function NotificationsPage() {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['notifications'], queryFn: () => listNotifications(1, 50) });

    const markOne = useMutation({
        mutationFn: (id: string) => markRead(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['notifications'] });
            qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
        },
    });

    const markAll = useMutation({
        mutationFn: markAllRead,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['notifications'] });
            qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
        },
    });

    return (
        <section className="space-y-6">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Уведомления</h1>
                <button
                    onClick={() => markAll.mutate()}
                    disabled={markAll.isPending}
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg-elevated disabled:opacity-50">
                    Прочитать все
                </button>
            </header>

            {q.isLoading && <p className="text-fg-muted">Загружаем…</p>}
            {q.isError && <p className="text-danger">Не удалось загрузить.</p>}

            {q.data && q.data.length === 0 && <p className="text-fg-muted">Пока тихо.</p>}

            {q.data && q.data.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                    {q.data.map((n) => (
                        <NotificationRow key={n.id} n={n} onMarkRead={() => markOne.mutate(n.id)} />
                    ))}
                </ul>
            )}
        </section>
    );
}

function NotificationRow({
    n,
    onMarkRead,
}: {
    n: NotificationItem;
    onMarkRead: () => void;
}) {
    return (
        <li
            className={cn(
                'flex items-start gap-4 px-4 py-3',
                !n.isRead && 'bg-accent/5',
            )}>
            <div className={cn('mt-1.5 size-2 rounded-full', n.isRead ? 'bg-fg-muted/30' : 'bg-accent')} />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{n.title}</span>
                    <span className="shrink-0 text-xs text-fg-muted">
                        {new Date(n.createdAt).toLocaleString('ru')}
                    </span>
                </div>
                {n.message && <p className="mt-1 text-sm text-fg-muted">{n.message}</p>}
            </div>
            {!n.isRead && (
                <button
                    onClick={onMarkRead}
                    className="text-xs text-fg-muted hover:text-fg"
                    title="Пометить прочитанным">
                    ✓
                </button>
            )}
        </li>
    );
}