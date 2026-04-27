import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listPlaylists, listPublicPlaylists } from '@/shared/api/playlists';
import {
    acceptInvitation,
    declineInvitation,
    listIncomingInvitations,
} from '@/shared/api/invitations';
import { CreatePlaylistDialog } from '@/features/playlists/CreatePlaylistDialog';
import { cn } from '@/shared/lib/cn';

type Tab = 'mine' | 'public';

export function PlaylistsPage() {
    const [tab, setTab] = useState<Tab>('mine');
    const [createOpen, setCreateOpen] = useState(false);

    const mine = useQuery({ queryKey: ['playlists'], queryFn: listPlaylists, enabled: tab === 'mine' });
    const pub = useQuery({
        queryKey: ['playlists-public'],
        queryFn: listPublicPlaylists,
        enabled: tab === 'public',
    });

    const invs = useQuery({
        queryKey: ['invitations'],
        queryFn: listIncomingInvitations,
    });
    const pending = invs.data?.filter((i) => i.status === 'Pending') ?? [];

    return (
        <section className="space-y-8">
            <header className="flex items-center justify-between">
                <h1 className="text-2xl font-semibold">Плейлисты</h1>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
                >
                    + Новый
                </button>
            </header>

            {pending.length > 0 && <PendingInvitations />}

            <div className="flex gap-4 border-b border-border text-sm">
                <TabBtn active={tab === 'mine'} onClick={() => setTab('mine')}>
                    Мои
                </TabBtn>
                <TabBtn active={tab === 'public'} onClick={() => setTab('public')}>
                    Публичные
                </TabBtn>
            </div>

            {tab === 'mine' && (
                <PlaylistGrid
                    loading={mine.isLoading}
                    error={mine.isError}
                    items={mine.data}
                    empty="Пока ни одного плейлиста — нажми «Новый»."
                />
            )}
            {tab === 'public' && (
                <PlaylistGrid
                    loading={pub.isLoading}
                    error={pub.isError}
                    items={pub.data}
                    empty="Никто не публиковал плейлисты."
                />
            )}

            <CreatePlaylistDialog open={createOpen} onClose={() => setCreateOpen(false)} />
        </section>
    );
}

function TabBtn({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                '-mb-px border-b-2 px-3 py-2 text-fg-muted hover:text-fg',
                active ? 'border-accent text-fg' : 'border-transparent',
            )}
        >
            {children}
        </button>
    );
}

function PlaylistGrid({
    loading,
    error,
    items,
    empty,
}: {
    loading: boolean;
    error: boolean;
    items: import('@/shared/types').PlaylistSummary[] | undefined;
    empty: string;
}) {
    if (loading) return <p className="text-fg-muted">Загружаем…</p>;
    if (error) return <p className="text-danger">Не удалось загрузить.</p>;
    if (!items || items.length === 0) return <p className="text-fg-muted">{empty}</p>;

    return (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {items.map((p) => (
                <li key={p.id}>
                    <Link
                        to={`/playlists/${p.id}`}
                        className="block space-y-2 rounded-md border border-border bg-bg-elevated p-3 hover:bg-bg-elevated/70"
                    >
                        <div
                            className="aspect-square w-full rounded bg-bg bg-cover bg-center"
                            style={{ backgroundImage: p.coverUrl ? `url(${p.coverUrl})` : undefined }}
                            aria-hidden
                        />
                        <div className="truncate text-sm font-medium">{p.title}</div>
                        <div className="flex items-center justify-between text-xs text-fg-muted">
                            <span>{p.trackCount} треков</span>
                            <span>{p.visibility}</span>
                        </div>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

function PendingInvitations() {
    const qc = useQueryClient();
    const q = useQuery({ queryKey: ['invitations'], queryFn: listIncomingInvitations });
    const accept = useMutation({
        mutationFn: (id: string) => acceptInvitation(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['invitations'] });
            qc.invalidateQueries({ queryKey: ['playlists'] });
        },
    });
    const decline = useMutation({
        mutationFn: (id: string) => declineInvitation(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['invitations'] }),
    });

    const pending = q.data?.filter((i) => i.status === 'Pending') ?? [];
    if (pending.length === 0) return null;

    return (
        <section className="space-y-2">
            <h2 className="text-sm font-medium text-fg-muted">Приглашения</h2>
            <ul className="divide-y divide-border rounded-md border border-border">
                {pending.map((inv) => (
                    <li key={inv.id} className="flex items-center gap-4 p-3 text-sm">
                        <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{inv.playlistTitle}</div>
                            <div className="text-xs text-fg-muted">
                                от {inv.inviterName ?? inv.inviterId.slice(0, 8)} · роль {inv.proposedRole}
                            </div>
                        </div>
                        <button
                            onClick={() => accept.mutate(inv.id)}
                            disabled={accept.isPending}
                            className="rounded-md bg-accent px-3 py-1.5 text-xs text-accent-fg hover:opacity-90 disabled:opacity-50"
                        >
                            Принять
                        </button>
                        <button
                            onClick={() => decline.mutate(inv.id)}
                            disabled={decline.isPending}
                            className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-bg-elevated disabled:opacity-50"
                        >
                            Отказаться
                        </button>
                    </li>
                ))}
            </ul>
        </section>
    );
}