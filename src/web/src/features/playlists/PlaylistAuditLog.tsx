import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getPlaylistAudit, PlaylistAudit } from '@/shared/api/playlists';
import { batchUsers } from '@/shared/api/users';
import { cn } from '@/shared/lib/cn';
import { ClockIcon, PlusIcon, TrashIcon, PencilIcon, UserIcon, LogOutIcon, RefreshIcon } from '@/shared/ui/icons';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import type { UserSearchResult } from '@/shared/types';

const PAGE_SIZE = 5;

export function PlaylistAuditLog({ playlistId }: { playlistId: string }) {
    const auditQuery = useInfiniteQuery({
        queryKey: ['playlist-audit', playlistId],
        queryFn: ({ pageParam = 0 }) => getPlaylistAudit(playlistId, pageParam, PAGE_SIZE),
        initialPageParam: 0,
        getNextPageParam: (lastPage, allPages) => {
            return lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined;
        },
    });

    const logs = useMemo(() => {
        return auditQuery.data?.pages.flat() || [];
    }, [auditQuery.data]);

    const userIds = useMemo(() => {
        return Array.from(new Set(logs.map(a => a.actorUserId).filter(Boolean))) as string[];
    }, [logs]);

    const usersQuery = useQuery({
        queryKey: ['user-names', ...userIds.sort()],
        queryFn: () => batchUsers(userIds),
        enabled: userIds.length > 0,
        staleTime: 5 * 60 * 1000,
    });

    const userMap = useMemo(() => {
        const map: Record<string, UserSearchResult> = {};
        usersQuery.data?.forEach(u => map[u.id] = u);
        return map;
    }, [usersQuery.data]);

    if (auditQuery.isLoading) {
        return (
            <div className="flex flex-col gap-4 p-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4 animate-pulse">
                        <div className="size-10 rounded-full bg-border/50 shrink-0" />
                        <div className="flex-1 space-y-2 py-2">
                            <div className="h-4 bg-border/50 rounded w-3/4" />
                            <div className="h-3 bg-border/50 rounded w-1/4" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (auditQuery.isError) return <p className="text-sm text-danger p-4 text-center">Ошибка загрузки истории.</p>;

    return (
        <div className="flex flex-col h-full max-h-[500px]">
            {/* Header actions */}
            <div className="flex justify-end p-3 border-b border-border/50 bg-bg-elevated/50 sticky top-0 z-10">
                <button
                    onClick={() => auditQuery.refetch()}
                    disabled={auditQuery.isFetching && !auditQuery.isFetchingNextPage}
                    className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-fg-muted hover:bg-bg-elevated hover:text-fg disabled:opacity-50 transition-colors"
                >
                    <RefreshIcon className={cn("size-3.5", auditQuery.isFetching && !auditQuery.isFetchingNextPage && "animate-spin")} />
                    {auditQuery.isFetching && !auditQuery.isFetchingNextPage ? 'Обновление...' : 'Обновить'}
                </button>
            </div>

            {/* Timeline content */}
            <div className="flex-1 overflow-y-auto p-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full">
                {logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-fg-muted">
                        <ClockIcon className="size-10 opacity-20 mb-3" />
                        <p className="text-sm">История пуста.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {logs.map((log, index) => (
                            <AuditRow
                                key={log.id}
                                log={log}
                                userMap={userMap}
                                isLast={index === logs.length - 1 && !auditQuery.hasNextPage}
                            />
                        ))}

                        {/* Загрузить еще */}
                        {auditQuery.hasNextPage && (
                            <div className="flex justify-center pt-4 pb-2 relative">
                                {/* Продолжение линии таймлайна */}
                                <div className="absolute top-0 bottom-full left-5 w-px bg-border/50" />

                                <button
                                    onClick={() => auditQuery.fetchNextPage()}
                                    disabled={auditQuery.isFetchingNextPage}
                                    className="rounded-full border border-border bg-bg-elevated px-5 py-2 text-sm font-medium text-fg hover:border-fg-muted disabled:opacity-50 transition-all shadow-sm z-10"
                                >
                                    {auditQuery.isFetchingNextPage ? 'Загрузка...' : 'Загрузить еще'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function AuditRow({ log, userMap, isLast }: { log: PlaylistAudit; userMap: Record<string, UserSearchResult>; isLast: boolean }) {
    const [isOpen, setIsOpen] = useState(false);

    const user = log.actorUserId ? userMap[log.actorUserId] : null;
    const actorName = user?.displayName ?? (log.actorUserId ? 'Пользователь' : 'Система');
    const avatarUrl = user?.avatarUrl;

    const actorLink = log.actorUserId ? (
        <Link
            to={`/users/${log.actorUserId}`}
            className="font-bold text-fg hover:text-accent transition-colors truncate max-w-[120px]"
            onClick={(e) => e.stopPropagation()}
        >
            {actorName}
        </Link>
    ) : (
        <span className="font-bold text-fg">{actorName}</span>
    );

    const actionInfo = useMemo(() => {
        if (log.entityType === 'PlaylistTrack') {
            if (log.changeKind === 0) return { icon: <PlusIcon className="size-4" />, color: "text-success bg-success/10 border-success/20", label: "Добавил трек" };
            if (log.changeKind === 2) return { icon: <TrashIcon className="size-4" />, color: "text-danger bg-danger/10 border-danger/20", label: "Удалил трек" };
            if (log.changeKind === 1) return { icon: <PencilIcon className="size-4" />, color: "text-accent bg-accent/10 border-accent/20", label: "Изменил позицию" };
        }
        if (log.entityType === 'PlaylistMember') {
            if (log.changeKind === 0) return { icon: <UserIcon className="size-4" />, color: "text-success bg-success/10 border-success/20", label: "Присоединился" };
            if (log.changeKind === 2) return { icon: <LogOutIcon className="size-4" />, color: "text-fg-muted bg-border border-border", label: "Покинул плейлист" };
            if (log.changeKind === 1) return { icon: <PencilIcon className="size-4" />, color: "text-accent bg-accent/10 border-accent/20", label: "Изменил роль" };
        }
        if (log.entityType === 'Playlist') {
            if (log.changeKind === 1) return { icon: <PencilIcon className="size-4" />, color: "text-accent bg-accent/10 border-accent/20", label: "Изменил плейлист" };
        }
        return { icon: <ClockIcon className="size-4" />, color: "text-fg-muted bg-border border-border", label: "Сделал изменения" };
    }, [log]);

    const detailedChanges = useMemo(() => {
        try {
            const data = JSON.parse(log.changes);
            const items: string[] = [];

            const fieldLabels: Record<string, string> = {
                Title: 'Название',
                Visibility: 'Приватность',
                Position: 'Позиция',
                IsCollaborative: 'Совместный доступ'
            };

            const visibilityMap: Record<string | number, string> = {
                0: 'Private',
                1: 'Public',
                2: 'Unlisted'
            };

            for (const key in data) {
                const val = data[key];
                const displayKey = fieldLabels[key] || key;

                if (val && typeof val === 'object') {
                    let oldVal = val.Old ?? val.old;
                    let newVal = val.New ?? val.new;

                    if (key === 'Visibility') {
                        if (oldVal !== undefined) oldVal = visibilityMap[oldVal] ?? oldVal;
                        if (newVal !== undefined) newVal = visibilityMap[newVal] ?? newVal;
                    }

                    if (typeof oldVal === 'boolean') oldVal = oldVal ? 'Да' : 'Нет';
                    if (typeof newVal === 'boolean') newVal = newVal ? 'Да' : 'Нет';

                    if (oldVal !== undefined || newVal !== undefined) {
                        items.push(`${displayKey}: ${oldVal ?? 'пусто'} → ${newVal ?? 'пусто'}`);
                        continue;
                    }
                }

                items.push(`${displayKey}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
            }
            return items;
        } catch {
            return [];
        }
    }, [log.changes]);

    return (
        <div className="relative flex items-start gap-3 group">
            {/* Линия таймлайна */}
            {!isLast && <div className="absolute top-10 bottom-[-1rem] left-5 w-px bg-border/50" />}

            {/* Иконка действия */}
            <div className={cn(
                "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border shadow-sm",
                actionInfo.color
            )}>
                {actionInfo.icon}
            </div>

            {/* Карточка */}
            <div className="flex-1 rounded-lg border border-border/50 bg-bg p-3 shadow-sm hover:border-border transition-colors">
                <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Аватарка */}
                        <UserAvatar avatarUrl={avatarUrl} displayName={actorName} size={20} />

                        <div className="flex items-center gap-1.5 text-sm">
                            {actorLink}
                            <span className="text-fg-muted">{actionInfo.label}</span>
                            {log.trackTitle && (
                                <span className="font-medium text-fg max-w-[150px] truncate" title={log.trackTitle}>
                                    "{log.trackTitle}"
                                </span>
                            )}
                        </div>
                    </div>

                    <span className="text-xs text-fg-muted/70 whitespace-nowrap sm:ml-auto">
                        {new Date(log.createdAt).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>

                {/* Блок с деталями */}
                {detailedChanges.length > 0 && (
                    <div className="mt-2">
                        <button
                            onClick={() => setIsOpen(!isOpen)}
                            className="flex items-center gap-1 text-[11px] font-medium text-accent hover:underline px-1 py-0.5 rounded transition-colors"
                        >
                            {isOpen ? 'Скрыть детали' : 'Показать детали'}
                            <svg className={cn("size-3 transition-transform duration-200", isOpen && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {isOpen && (
                            <div className="mt-2 rounded bg-bg-elevated/50 p-2.5 border border-border/50 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                {detailedChanges.map((c, i) => (
                                    <div key={i} className="text-[11px] font-mono text-fg-muted break-all flex items-start gap-2">
                                        <span className="text-accent/50 shrink-0 select-none">↳</span>
                                        <span>{c}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}