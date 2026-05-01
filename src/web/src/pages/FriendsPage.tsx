import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    followUser,
    unfollowUser,
    getFollowedUsers,
    getFriends,
} from '@/shared/api/follows';
import { searchUsers } from '@/shared/api/users';
import type { UserSearchResult, FollowedUser, FriendItem } from '@/shared/types';
import { cn } from '@/shared/lib/cn';

type Tab = 'friends' | 'following';

export function FriendsPage() {
    const [tab, setTab] = useState<Tab>('friends');
    const qc = useQueryClient();

    const friends = useQuery({
        queryKey: ['friends'],
        queryFn: getFriends,
        enabled: tab === 'friends',
    });

    const following = useQuery({
        queryKey: ['following-users'],
        queryFn: getFollowedUsers,
        enabled: tab === 'following',
    });

    return (
        <section className="space-y-6">
            <h1 className="text-2xl font-semibold">Люди</h1>

            {/* User search */}
            <UserSearch />

            {/* Tabs */}
            <div className="flex gap-4 border-b border-border text-sm">
                <TabBtn active={tab === 'friends'} onClick={() => setTab('friends')}>
                    Друзья (взаимные)
                </TabBtn>
                <TabBtn active={tab === 'following'} onClick={() => setTab('following')}>
                    Подписки
                </TabBtn>
            </div>

            {tab === 'friends' && (
                <FriendsList data={friends.data} loading={friends.isLoading} qc={qc} />
            )}
            {tab === 'following' && (
                <FollowingList data={following.data} loading={following.isLoading} qc={qc} />
            )}
        </section>
    );
}

// User search + follow

function UserSearch() {
    const qc = useQueryClient();
    const [q, setQ] = useState('');
    const [results, setResults] = useState<UserSearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (q.trim().length < 2) { setResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try { setResults(await searchUsers(q)); }
            catch { setResults([]); }
            finally { setSearching(false); }
        }, 300);
    }, [q]);

    const follow = useMutation({
        mutationFn: (userId: string) => followUser(userId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['friends'] });
            qc.invalidateQueries({ queryKey: ['following-users'] });
        },
    });

    return (
        <div className="relative max-w-md">
            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Найти пользователя по имени или email…"
                className="w-full rounded-md border border-border bg-bg-elevated px-3 py-2 text-sm outline-none focus:border-accent"
            />
            {searching && (
                <p className="mt-1 text-xs text-fg-muted">Поиск…</p>
            )}
            {results.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-bg-elevated shadow-lg">
                    {results.map((u) => (
                        <li key={u.id} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-bg">
                            <span className="text-sm">{u.displayName}</span>
                            <button
                                onClick={() => { follow.mutate(u.id); setResults([]); setQ(''); }}
                                disabled={follow.isPending}
                                className="rounded-md bg-accent px-2 py-1 text-xs text-accent-fg hover:opacity-90 disabled:opacity-50"
                            >
                                Подписаться
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {!searching && q.trim().length >= 2 && results.length === 0 && (
                <p className="mt-1 text-xs text-fg-muted">Никого не найдено.</p>
            )}
        </div>
    );
}

// Friends list

function FriendsList({
    data,
    loading,
    qc,
}: {
    data?: FriendItem[];
    loading: boolean;
    qc: ReturnType<typeof useQueryClient>;
}) {
    const unfollow = useMutation({
        mutationFn: (userId: string) => unfollowUser(userId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['friends'] });
            qc.invalidateQueries({ queryKey: ['following-users'] });
        },
    });

    if (loading) return <p className="text-fg-muted">Загружаем…</p>;
    if (!data || data.length === 0)
        return <p className="text-fg-muted">Взаимных подписок пока нет. Найди людей через поиск выше.</p>;

    return (
        <ul className="divide-y divide-border rounded-md border border-border">
            {data.map((f) => (
                <li key={f.userId} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <div className="flex-1">
                        <div className="font-medium font-mono text-xs text-fg-muted">{f.userId.slice(0, 8)}…</div>
                        <div className="text-xs text-fg-muted">
                            Друзья с {new Date(f.sinceAt).toLocaleDateString('ru')}
                        </div>
                    </div>
                    <button
                        onClick={() => unfollow.mutate(f.userId)}
                        disabled={unfollow.isPending}
                        className="rounded-md border border-border px-3 py-1 text-xs hover:bg-bg-elevated disabled:opacity-50"
                    >
                        Отписаться
                    </button>
                </li>
            ))}
        </ul>
    );
}

// Following list

function FollowingList({
    data,
    loading,
    qc,
}: {
    data?: FollowedUser[];
    loading: boolean;
    qc: ReturnType<typeof useQueryClient>;
}) {
    const unfollow = useMutation({
        mutationFn: (userId: string) => unfollowUser(userId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['friends'] });
            qc.invalidateQueries({ queryKey: ['following-users'] });
        },
    });

    if (loading) return <p className="text-fg-muted">Загружаем…</p>;
    if (!data || data.length === 0)
        return <p className="text-fg-muted">Ни на кого не подписан.</p>;

    return (
        <ul className="divide-y divide-border rounded-md border border-border">
            {data.map((u) => (
                <li key={u.userId} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <div className="flex-1">
                        <div className="font-medium font-mono text-xs text-fg-muted">{u.userId.slice(0, 8)}…</div>
                        <div className="text-xs text-fg-muted">
                            {u.isMutual ? '👥 Взаимная подписка' : '-> Подписан'}
                            {' · '}
                            с {new Date(u.subscribedAt).toLocaleDateString('ru')}
                        </div>
                    </div>
                    <button
                        onClick={() => unfollow.mutate(u.userId)}
                        disabled={unfollow.isPending}
                        className="rounded-md border border-border px-3 py-1 text-xs hover:bg-bg-elevated disabled:opacity-50"
                    >
                        Отписаться
                    </button>
                </li>
            ))}
        </ul>
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