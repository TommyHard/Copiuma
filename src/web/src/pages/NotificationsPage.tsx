import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    deleteAllNotifications,
    deleteNotification,
    listNotifications,
    markAllRead,
    markRead,
} from '@/shared/api/notifications';
import type { NotificationItem, NotificationType } from '@/shared/types';
import { cn } from '@/shared/lib/cn';
import {
    TrashIcon,
    CheckIcon,
    BellIcon,
    UsersIcon,
    MusicIcon,
    PlayIcon,
    MailIcon,
    InfoIcon
} from '@/shared/ui/icons';
import { Tooltip } from '@/shared/ui/Tooltip';
import { acceptInvitation, declineInvitation } from '@/shared/api/invitations';

export function NotificationsPage() {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['notifications'], queryFn: () => listNotifications(1, 50) });

    const acceptInv = useMutation({
        mutationFn: (id: string) => acceptInvitation(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['notifications'] });
            qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
            qc.invalidateQueries({ queryKey: ['playlists'] });
            qc.invalidateQueries({ queryKey: ['invitations'] });
        },
    });

    const declineInv = useMutation({
        mutationFn: (id: string) => declineInvitation(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['notifications'] });
            qc.invalidateQueries({ queryKey: ['notifications-unread-count'] });
            qc.invalidateQueries({ queryKey: ['invitations'] });
        },
    });

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
    const unreadCount = q.data?.filter(n => !n.isRead).length || 0;

    return (
        <section className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-8 animate-in fade-in duration-300">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        Уведомления
                        {unreadCount > 0 && (
                            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-accent px-2 text-xs font-medium text-white">
                                {unreadCount}
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-fg-muted mt-1">
                        История ваших оповещений, приглашений и активности.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => clearRead.mutate()}
                        disabled={clearRead.isPending || !hasRead}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-bg hover:text-fg disabled:opacity-50 disabled:pointer-events-none"
                    >
                        Очистить прочитанные
                    </button>
                    <button
                        onClick={() => markAll.mutate()}
                        disabled={markAll.isPending || unreadCount === 0}
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        Прочитать все
                    </button>
                </div>
            </header>

            {q.isLoading && (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-24 w-full animate-pulse rounded-xl bg-border/40" />
                    ))}
                </div>
            )}

            {q.isError && (
                <div className="rounded-xl border border-danger/20 bg-danger/5 p-6 text-center text-danger">
                    Не удалось загрузить список уведомлений.
                </div>
            )}

            {q.data && q.data.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center text-fg-muted">
                    <div className="mb-4 rounded-full bg-bg p-4 shadow-sm">
                        <BellIcon viewBox="0 0 24 24" className="size-8 opacity-50" />
                    </div>
                    <p className="text-base font-medium">Пока ничего нет</p>
                    <p className="text-sm">Здесь будут появляться новые события и оповещения.</p>
                </div>
            )}

            {q.data && q.data.length > 0 && (
                <ul className="space-y-3">
                    {q.data.map((n) => (
                        <NotificationRow
                            key={n.id}
                            n={n}
                            onMarkRead={() => markOne.mutate(n.id)}
                            onDelete={() => removeOne.mutate(n.id)}
                            onAcceptInvitation={(invId) => acceptInv.mutate(invId)}
                            onDeclineInvitation={(invId) => declineInv.mutate(invId)}
                            invitationPending={acceptInv.isPending || declineInv.isPending}
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
    onAcceptInvitation,
    onDeclineInvitation,
    invitationPending,
}: {
    n: NotificationItem;
    onMarkRead: () => void;
    onDelete: () => void;
    onAcceptInvitation?: (invitationId: string) => void;
    onDeclineInvitation?: (invitationId: string) => void;
    invitationPending?: boolean;
}) {
    const renderPayloadAction = () => {
        if (!n.payload) return null;

        switch (n.type) {
            case 'PlaylistInvitation': {
                const payload = n.payload as Record<string, unknown>;
                const invitationId = (payload.invitationId ?? payload.InvitationId ?? payload.id ?? payload.Id) as string | undefined;
                const status = (payload.status ?? payload.Status) as string | undefined;
                if (status && status !== 'Pending') {
                    return (
                        <p className="mt-3 text-xs italic text-fg-muted">
                            {status === 'Accepted' ? 'Приглашение принято' : status === 'Declined' ? 'Приглашение отклонено' : status}
                        </p>
                    );
                }
                return (
                    <div className="mt-3 flex items-center gap-2">
                        <button
                            disabled={!invitationId || invitationPending}
                            onClick={() => invitationId && onAcceptInvitation?.(invitationId)}
                            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                            Принять
                        </button>
                        <button
                            disabled={!invitationId || invitationPending}
                            onClick={() => invitationId && onDeclineInvitation?.(invitationId)}
                            className="rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium transition-colors hover:bg-bg disabled:opacity-50"
                        >
                            Отклонить
                        </button>
                    </div>
                );
            }
            case 'NewTrackByFollowed':
                return (
                    <button className="mt-3 flex items-center gap-2 rounded-md bg-bg px-3 py-1.5 text-xs font-medium border border-border hover:border-accent transition-colors">
                        <PlayIcon className="size-4" />
                        Слушать релиз
                    </button>
                );
            default:
                return null;
        }
    };

    return (
        <li
            className={cn(
                'relative flex flex-col sm:flex-row items-start gap-4 rounded-xl border p-4 transition-all',
                n.isRead
                    ? 'border-transparent bg-transparent hover:bg-accent/10'
                    : 'border-accent/20 bg-accent/5 shadow-sm'
            )}>

            <div className="shrink-0 pt-1">
                <NotificationIcon type={n.type} isRead={n.isRead} />
            </div>

            <div className="min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <span className={cn("text-sm font-semibold", !n.isRead && "text-accent")}>
                            {n.title}
                        </span>
                        {n.message && <p className="mt-1 text-sm text-fg-muted leading-relaxed">{n.message}</p>}
                        {renderPayloadAction()}
                    </div>
                    <span className="shrink-0 text-xs text-fg-muted whitespace-nowrap">
                        {new Date(n.createdAt).toLocaleDateString('ru-RU', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                    </span>
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 self-end sm:self-center mt-4 sm:mt-0">
                {!n.isRead && (
                    <Tooltip content="Пометить прочитанным" position="top">
                        <button
                            onClick={onMarkRead}
                            className="rounded-md p-2 text-fg-muted hover:bg-bg hover:text-accent transition-colors"
                            aria-label="Пометить прочитанным">
                            <CheckIcon className="size-5" />
                        </button>
                    </Tooltip>
                )}
                <Tooltip content="Удалить" position="top">
                    <button
                        onClick={onDelete}
                        className="rounded-md p-2 text-fg-muted hover:bg-danger/10 hover:text-danger transition-colors"
                        aria-label="Удалить уведомление">
                        <TrashIcon className="size-5" />
                    </button>
                </Tooltip>
            </div>
        </li>
    );
}

function NotificationIcon({ type, isRead }: { type: NotificationType; isRead: boolean }) {
    const baseClasses = cn(
        "flex size-10 items-center justify-center rounded-full border",
        isRead ? "bg-bg border-border text-fg-muted" : "bg-accent/10 border-accent/20 text-accent"
    );

    const getIcon = () => {
        switch (type) {
            case 'TrackProcessed':
                return <MusicIcon className="w-5 h-5" />;
            case 'NewFollower':
                return <UsersIcon className="w-5 h-5" />;
            case 'PlaylistInvitation':
                return <MailIcon className="w-5 h-5" />;
            default:
                return <InfoIcon className="w-5 h-5" />;
        }
    };

    return (
        <div className={baseClasses}>
            {getIcon()}
        </div>
    );
}