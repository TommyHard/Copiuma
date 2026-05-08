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
    disabled?: boolean;
}

export function FollowArtistButton({ artistId, className, disabled }: FollowArtistButtonProps) {
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
        ? 'h-10 px-6 rounded bg-bg-elevated text-fg font-bold shadow-sm hover:bg-danger hover:text-white transition-colors flex items-center justify-center disabled:opacity-50'
        : 'h-10 px-6 rounded bg-accent text-white font-bold shadow-sm hover:bg-accent/90 transition-colors flex items-center justify-center disabled:opacity-50';

    return (
        <button
            onClick={() => (isFollowing ? unfollow.mutate() : follow.mutate())}
            disabled={busy || disabled}
            className={cn(baseClasses, className)}
        >
            {isFollowing ? 'Отписаться' : 'Подписаться'}
        </button>
    );
}