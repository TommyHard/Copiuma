import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { getPlaylistAudit, PlaylistAudit } from '@/shared/api/playlists';
import { batchUsers } from '@/shared/api/users';
import { cn } from '@/shared/lib/cn';

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

    const nameMap = useMemo(() => {
        const map: Record<string, string> = {};
        usersQuery.data?.forEach(u => map[u.id] = u.displayName);
        return map;
    }, [usersQuery.data]);

    if (auditQuery.isLoading) return <p className="text-sm text-fg-muted py-4">Загрузка истории...</p>;
    if (auditQuery.isError) return <p className="text-sm text-danger py-4">Ошибка загрузки истории.</p>;

    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                <button
                    onClick={() => auditQuery.refetch()}
                    disabled={auditQuery.isFetching && !auditQuery.isFetchingNextPage}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-fg-muted hover:bg-bg-elevated hover:text-fg disabled:opacity-50 transition-colors"
                >
                    {auditQuery.isFetching && !auditQuery.isFetchingNextPage ? 'Обновление...' : 'Обновить историю'}
                </button>
            </div>

            {logs.length === 0 ? (
                <p className="text-sm text-fg-muted py-4">История пуста.</p>
            ) : (
                <>
                    <div className="divide-y divide-border rounded-md border border-border bg-bg-elevated/20 overflow-y-auto max-h-[400px]">
                        {logs.map((log) => (
                            <AuditRow key={log.id} log={log} nameMap={nameMap} />
                        ))}
                    </div>

                    {/* Загрузить еще */}
                    {auditQuery.hasNextPage && (
                        <div className="flex justify-center pt-2">
                            <button
                                onClick={() => auditQuery.fetchNextPage()}
                                disabled={auditQuery.isFetchingNextPage}
                                className="rounded-md border border-border px-4 py-2 text-sm text-fg-muted hover:bg-bg-elevated hover:text-fg disabled:opacity-50 transition-colors"
                            >
                                {auditQuery.isFetchingNextPage ? 'Загрузка...' : 'Загрузить еще'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function AuditRow({ log, nameMap }: { log: PlaylistAudit; nameMap: Record<string, string> }) {
    const [isOpen, setIsOpen] = useState(false);

    const actorName = log.actorUserId ? (nameMap[log.actorUserId] ?? 'Пользователь') : 'Система';
    const actorLink = log.actorUserId ? (
        <Link
            to={`/users/${log.actorUserId}`}
            className="font-medium text-fg hover:underline transition-colors"
            onClick={(e) => e.stopPropagation()}
        >
            {actorName}
        </Link>
    ) : (
        <span className="font-medium text-fg">{actorName}</span>
    );

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
                0: 'Приватный (Private)',
                1: 'Публичный (Public)',
                2: 'По ссылке (Unlisted)'
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

    const actionText = useMemo(() => {
        if (log.entityType === 'PlaylistTrack') {
            const trackName = log.trackTitle ? <span className="font-medium text-fg italic">«{log.trackTitle}»</span> : 'трек';
            if (log.changeKind === 0) return <span>добавил {trackName}</span>;
            if (log.changeKind === 2) return <span>удалил {trackName}</span>;
            if (log.changeKind === 1) return <span>изменил позицию для {trackName}</span>;
        }
        if (log.entityType === 'PlaylistMember') {
            if (log.changeKind === 0) return <span>присоединился к плейлисту</span>;
            if (log.changeKind === 2) return <span>покинул плейлист</span>;
            if (log.changeKind === 1) return <span>изменил роль участника</span>;
        }
        if (log.entityType === 'Playlist') {
            if (log.changeKind === 1) return <span>изменил настройки плейлиста</span>;
        }
        return <span>сделал изменения ({log.entityType})</span>;
    }, [log]);

    return (
        <div className="border-b border-border last:border-0 bg-bg-elevated/10">
            <div
                className="flex items-center gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-bg-elevated/30 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className={cn(
                    "flex size-2 shrink-0 rounded-full",
                    log.changeKind === 0 ? "bg-success" : log.changeKind === 2 ? "bg-danger" : "bg-accent"
                )} />
                <div className="flex-1 text-fg-muted leading-tight">
                    {actorLink} {actionText}
                </div>
                <div className="shrink-0 text-[11px] text-fg-muted/60 uppercase">
                    {new Date(log.createdAt).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                <span className={cn("text-xs text-fg-muted transition-transform", isOpen && "rotate-180")}>▼</span>
            </div>

            {isOpen && (
                <div className="px-9 pb-3 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="rounded-md border border-border/50 bg-bg-elevated/40 p-3 space-y-1">
                        <h4 className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider mb-2">Детали изменения</h4>
                        {detailedChanges.length > 0 ? (
                            detailedChanges.map((c, i) => (
                                <div key={i} className="text-xs font-mono text-fg-muted break-all">
                                    <span className="text-accent/50 mr-2">#</span> {c}
                                </div>
                            ))
                        ) : (
                            <div className="text-xs font-mono text-fg-muted italic">Нет дополнительных данных в логе</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}