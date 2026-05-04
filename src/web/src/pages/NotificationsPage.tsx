import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    deleteAllNotifications,
    deleteNotification,
    listNotifications,
    markAllRead,
    markRead,
} from '@/shared/api/notifications';
import type { NotificationItem } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

export function NotificationsPage() {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['notifications'], queryFn: () => listNotifications(1, 50) });

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ['notifications'] });
        qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    };

    const markOne = useMutation({
        mutationFn: (id: string) => markRead(id),
        onSuccess: invalidate,
    });

    const markAll = useMutation({
        mutationFn: markAllRead,
        onSuccess: invalidate,
    });

    const removeOne = useMutation({
        mutationFn: (id: string) => deleteNotification(id),
        onMutate: async (id) => {
            await qc.cancelQueries({ queryKey: ['notifications'] });
            const prev = qc.getQueryData<NotificationItem[]>(['notifications']);
            if (prev) {
                qc.setQueryData<NotificationItem[]>(
                    ['notifications'],
                    prev.filter((n) => n.id !== id),
                );
            }
            return { prev };
        },
        onError: (_e, _id, ctx) => {
            if (ctx?.prev) qc.setQueryData(['notifications'], ctx.prev);
        },
        onSettled: invalidate,
    });

    const clearRead = useMutation({
        mutationFn: () => deleteAllNotifications(true),
        onSuccess: invalidate,
    });

    const hasRead = !!q.data?.some((n) => n.isRead);

    return (
        <section className="space-y-6">
            <header className="flex items-center justify-between gap-2">
                <h1 className="text-2xl font-semibold">Уведомления</h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => clearRead.mutate()}
                        disabled={clearRead.isPending || !hasRead}
                        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg-elevated disabled:opacity-50"
                        title="Удалить все прочитанные">
                        Очистить прочитанные
                    </button>
                    <button
                        onClick={() => markAll.mutate()}
                        disabled={markAll.isPending}
                        className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-bg-elevated disabled:opacity-50">
                        Прочитать все
                    </button>
                </div>
            </header>

            {q.isLoading && <p className="text-fg-muted">Загружаем…</p>}
            {q.isError && <p className="text-danger">Не удалось загрузить.</p>}

            {q.data && q.data.length === 0 && <p className="text-fg-muted">Пока тихо.</p>}

            {q.data && q.data.length > 0 && (
                <ul className="divide-y divide-border rounded-md border border-border">
                    {q.data.map((n) => (
                        <NotificationRow
                            key={n.id}
                            n={n}
                            onMarkRead={() => markOne.mutate(n.id)}
                            onDelete={() => removeOne.mutate(n.id)}
                        />
                    ))}
                </ul>
            )}
        </section>
    );
}

function NotificationRow({
    n,
    onMarkRead,
    onDelete,
}: {
    n: NotificationItem;
    onMarkRead: () => void;
    onDelete: () => void;
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
            <div className="flex shrink-0 items-center gap-1">
                {!n.isRead && (
                    <button
                        onClick={onMarkRead}
                        className="rounded p-1 text-fg-muted hover:bg-bg-elevated hover:text-fg"
                        title="Пометить прочитанным"
                        aria-label="Пометить прочитанным">
                        ✓
                    </button>
                )}
                <button
                    onClick={onDelete}
                    className="rounded p-1 text-fg-muted hover:bg-bg-elevated hover:text-danger"
                    title="Удалить"
                    aria-label="Удалить уведомление">
                    ✕
                </button>
            </div>
        </li>
    );
}