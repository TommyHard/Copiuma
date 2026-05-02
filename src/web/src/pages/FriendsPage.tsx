import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    followUser,
    unfollowUser,
    getFollowedUsers,
    listFollowedArtists,
    unfollowArtist,
} from '@/shared/api/follows';
import { searchUsers, batchUsers } from '@/shared/api/users';
import type { UserSearchResult, FollowedUser, FollowedArtist } from '@/shared/types';

export function FriendsPage() {
    const qc = useQueryClient();

    const following = useQuery({
        queryKey: ['following-users'],
        queryFn: getFollowedUsers,
    });

    const followedArtists = useQuery({
        queryKey: ['followed-artists'],
        queryFn: listFollowedArtists,
    });

    const userIds = (following.data ?? []).map((u) => u.userId);

    const namesQuery = useQuery({
        queryKey: ['user-names', ...userIds.sort()],
        queryFn: () => batchUsers(userIds),
        enabled: userIds.length > 0,
    });

    const nameMap: Record<string, string> = {};
    for (const u of namesQuery.data ?? []) {
        nameMap[u.id] = u.displayName;
    }

    return (
        <section className="space-y-6">
            <h1 className="text-2xl font-semibold">Подписки</h1>

            {/* User search */}
            <UserSearch />

            {/* Подписки на артистов */}
            {followedArtists.data && followedArtists.data.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-medium">Артисты</h2>
                    <ArtistFollowsList data={followedArtists.data} qc={qc} />
                </div>
            )}

            {/* Подписки на пользователей */}
            <div className="space-y-3">
                <h2 className="text-lg font-medium">Пользователи</h2>
                <FollowingList data={following.data} loading={following.isLoading} nameMap={nameMap} qc={qc} />
            </div>
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

// Artist follows list

function ArtistFollowsList({
    data,
    qc,
}: {
    data: FollowedArtist[];
    qc: ReturnType<typeof useQueryClient>;
}) {
    const unfollow = useMutation({
        mutationFn: (artistId: string) => unfollowArtist(artistId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['followed-artists'] });
        },
    });

    return (
        <ul className="divide-y divide-border rounded-md border border-border">
            {data.map((a) => (
                <li key={a.artistId} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <div className="flex-1">
                        <Link
                            to={`/artists/${a.artistId}`}
                            className="font-medium hover:underline"
                        >
                            {a.name}
                        </Link>
                        <div className="text-xs text-fg-muted">
                            Подписка от {new Date(a.followedAt).toLocaleDateString('ru')}
                        </div>
                    </div>
                    <button
                        onClick={() => unfollow.mutate(a.artistId)}
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

// Following list (users)

function FollowingList({
    data,
    loading,
    nameMap,
    qc,
}: {
    data?: FollowedUser[];
    loading: boolean;
    nameMap: Record<string, string>;
    qc: ReturnType<typeof useQueryClient>;
}) {
    const unfollow = useMutation({
        mutationFn: (userId: string) => unfollowUser(userId),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['following-users'] });
        },
    });

    if (loading) return <p className="text-fg-muted">Загружаем…</p>;
    if (!data || data.length === 0)
        return <p className="text-fg-muted">Ни на кого не подписан. Найди людей через поиск выше.</p>;

    return (
        <ul className="divide-y divide-border rounded-md border border-border">
            {data.map((u) => (
                <li key={u.userId} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <div className="flex-1">
                        <div className="font-medium">
                            {nameMap[u.userId] ?? <span className="font-mono text-xs text-fg-muted">{u.userId.slice(0, 8)}…</span>}
                        </div>
                        <div className="text-xs text-fg-muted">
                            с {new Date(u.subscribedAt).toLocaleDateString('ru')}
                        </div>
                    </div>
                    <button
                        onClick={() => unfollow.mutate(u.userId)}
                        disabled={unfollow.isPending}
                        className="rounded-md border border-border px-3 py-1 text-xs hover:bg-bg-elevated disabled:opacity-50">
                        Отписаться
                    </button>
                </li>
            ))}
        </ul>
    );
}