import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    followArtist,
    listFollowedArtists,
    unfollowArtist,
} from '@/shared/api/follows';

export function FollowArtistButton({ artistId }: { artistId: string }) {
    const qc = useQueryClient();
    const followed = useQuery({
        queryKey: ['followed-artists'],
        queryFn: listFollowedArtists,
    });

    const isFollowing = followed.data?.some((a) => a.id === artistId) ?? false;

    const follow = useMutation({
        mutationFn: () => followArtist(artistId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['followed-artists'] }),
    });
    const unfollow = useMutation({
        mutationFn: () => unfollowArtist(artistId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['followed-artists'] }),
    });

    const busy = follow.isPending || unfollow.isPending || followed.isLoading;

    return (
        <button
            onClick={() => (isFollowing ? unfollow.mutate() : follow.mutate())}
            disabled={busy}
            className={
                isFollowing
                    ? 'rounded-md border border-border px-4 py-2 text-sm hover:bg-bg-elevated disabled:opacity-50'
                    : 'rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90 disabled:opacity-50'
            }
        >
            {isFollowing ? 'Отписаться' : 'Подписаться'}
        </button>
    );
}