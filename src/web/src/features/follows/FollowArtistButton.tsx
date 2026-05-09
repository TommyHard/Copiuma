import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    followArtist,
    listFollowedArtists,
    unfollowArtist,
} from '@/shared/api/follows';
import { cn } from '@/shared/lib/cn';
import { CheckIcon, PlusIcon } from '@/shared/ui/icons';

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
        ? 'h-14 px-4 rounded font-black uppercase tracking-widest bg-bg-elevated text-fg border border-border shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50'
        : 'h-14 px-4 rounded font-black uppercase tracking-widest bg-accent text-accent-fg shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50';

    return (
        <button
            onClick={() => (isFollowing ? unfollow.mutate() : follow.mutate())}
            disabled={busy || disabled}
            className={cn(baseClasses, className)}
        >
            {isFollowing ? (
                <>
                    <CheckIcon className="size-6" /> Подписаны
                </>
            ) : (
                <>
                    <PlusIcon className="size-6" /> Подписаться
                </>
            )}
        </button>
    );
}