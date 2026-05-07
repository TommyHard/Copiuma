import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { followUser, getFollowedUsers, unfollowUser } from '@/shared/api/follows';

export function FollowUserButton({ userId }: { userId: string }) {
    const qc = useQueryClient();
    const followed = useQuery({
        queryKey: ['followed-users'],
        queryFn: getFollowedUsers,
    });

    const isFollowing = followed.data?.some((u) => u.userId === userId) ?? false;

    const follow = useMutation({
        mutationFn: () => followUser(userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['followed-users'] }),
    });
    const unfollow = useMutation({
        mutationFn: () => unfollowUser(userId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['followed-users'] }),
    });

    const busy = follow.isPending || unfollow.isPending || followed.isLoading;

    return (
        <button
            onClick={() => (isFollowing ? unfollow.mutate() : follow.mutate())}
            disabled={busy}
            className={
                isFollowing
                    ? 'rounded border border-border px-4 py-2 text-sm hover:bg-bg-elevated disabled:opacity-50'
                    : 'rounded bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-50'
            }
        >
            {isFollowing ? 'Отписаться' : 'Подписаться'}
        </button>
    );
}