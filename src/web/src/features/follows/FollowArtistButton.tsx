import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    followArtist,
    listFollowedArtists,
    unfollowArtist,
} from '@/shared/api/follows';
import { cn } from '@/shared/lib/cn';

interface FollowArtistButtonProps {
    artistId: string;
    className?: string;
}

export function FollowArtistButton({ artistId, className }: FollowArtistButtonProps) {
    const qc = useQueryClient();

    const followed = useQuery({
        queryKey: ['followed-artists'],
        queryFn: listFollowedArtists,
    });

    const isFollowing = followed.data?.some((a) => a.artistId === artistId) ?? false;

    const follow = useMutation({
        mutationFn: () => followArtist(artistId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['followed-artists'] }),
    });

    const unfollow = useMutation({
        mutationFn: () => unfollowArtist(artistId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['followed-artists'] }),
    });

    const busy = follow.isPending || unfollow.isPending || followed.isLoading;

    const baseClasses = isFollowing
        ? 'rounded-md border border-border bg-transparent px-4 py-2 text-sm font-medium text-black dark:text-white hover:border-fg/40 hover:bg-bg-elevated disabled:opacity-50 transition-colors'
        : 'rounded-md bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:opacity-50 transition-colors';

    return (
        <button
            onClick={() => (isFollowing ? unfollow.mutate() : follow.mutate())}
            disabled={busy}
            className={cn(baseClasses, className)}
        >
            {isFollowing ? 'Отписаться' : 'Подписаться'}
        </button>
    );
}