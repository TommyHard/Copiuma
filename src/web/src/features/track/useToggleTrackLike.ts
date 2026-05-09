import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toggleLike } from '@/shared/api/tracks';
import type { FavoriteItem, FriendFeedItem, TrackListItem } from '@/shared/types';

const TRACK_LIST_QUERY_PREFIXES: readonly (readonly unknown[])[] = [
    ['catalog'],
    ['catalog-infinite'],
    ['popular'],
    ['for-you'],
    ['similar'],
    ['feed'],
    ['friends-feed'],
    ['artist-tracks'],
    ['artist-featured-on'],
    ['album-tracks'],
    ['playlist'],
    ['search'],
    ['search-tracks'],
    ['search-albums'],
    ['search-users'],
    ['search-artists'],
    ['history-tracks'],
    ['history-tracks-infinite'],
    ['history-raw'],
    ['history-raw-infinite'],
];

const INVALIDATE_PREFIXES: readonly (readonly unknown[])[] = [
    ...TRACK_LIST_QUERY_PREFIXES,
    ['favorites'],
];

type AnyTrackList =
    | TrackListItem[]
    | FavoriteItem[]
    | FriendFeedItem[]
    | { tracks?: unknown[];[k: string]: unknown }
    | unknown;

function patchLikedInCaches(
    qc: QueryClient,
    trackId: string,
    nextValue: boolean,
): void {
    for (const prefix of TRACK_LIST_QUERY_PREFIXES) {
        qc.setQueriesData<AnyTrackList>({ queryKey: prefix as unknown[] }, (old: unknown) => {
            if (old == null) return old;
            const matched = matchAndPatch(old, trackId, nextValue);
            return matched.changed ? matched.value : old;
        });
    }
}

function matchAndPatch(
    data: unknown,
    trackId: string,
    nextValue: boolean,
): { value: unknown; changed: boolean } {
    if (Array.isArray(data)) {
        let changed = false;
        const next = data.map((item) => {
            if (Array.isArray(item)) {
                const inner = matchAndPatch(item, trackId, nextValue);
                if (inner.changed) changed = true;
                return inner.value;
            }

            if (!item || typeof item !== 'object') return item;
            const obj = item as Record<string, unknown>;

            // friends-feed
            if (obj.track && typeof obj.track === 'object') {
                const inner = obj.track as Record<string, unknown>;
                if (inner.id === trackId && inner.isLikedByMe !== nextValue) {
                    changed = true;
                    return { ...obj, track: { ...inner, isLikedByMe: nextValue } };
                }
                return obj;
            }

            // FavoriteItem[]
            if (obj.id === trackId && !('isLikedByMe' in obj) && 'likedAt' in obj && !nextValue) {
                changed = true;
                return null;
            }

            if (obj.id === trackId && obj.isLikedByMe !== nextValue) {
                changed = true;
                return { ...obj, isLikedByMe: nextValue };
            }

            if (obj.trackId === trackId && obj.isLikedByMe !== nextValue) {
                changed = true;
                return { ...obj, isLikedByMe: nextValue };
            }

            return obj;
        }).filter((x) => x !== null);

        return { value: changed ? next : data, changed };
    }

    if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        let changed = false;
        const next: Record<string, unknown> = { ...obj };

        // TrackDetail
        if (obj.id === trackId && 'isLikedByMe' in obj && obj.isLikedByMe !== nextValue) {
            changed = true;
            next.isLikedByMe = nextValue;
        }

        for (const key of Object.keys(obj)) {
            const v = obj[key];
            if (Array.isArray(v)) {
                const inner = matchAndPatch(v, trackId, nextValue);
                if (inner.changed) {
                    next[key] = inner.value;
                    changed = true;
                }
            }
        }

        return { value: changed ? next : data, changed };
    }

    return { value: data, changed: false };
}

export function useToggleTrackLike() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: ({ trackId }: { trackId: string; nextLiked: boolean }) =>
            toggleLike(trackId),

        onMutate: async ({ trackId, nextLiked }) => {
            await qc.cancelQueries();

            const snapshots: { key: readonly unknown[]; data: unknown }[] = [];
            for (const prefix of TRACK_LIST_QUERY_PREFIXES) {
                const found = qc.getQueriesData({ queryKey: prefix as unknown[] });
                for (const [k, d] of found) {
                    snapshots.push({ key: k, data: d });
                }
            }
            const detailKey = ['track', trackId] as const;
            const detail = qc.getQueryData(detailKey);
            if (detail !== undefined) {
                snapshots.push({ key: detailKey, data: detail });
            }

            patchLikedInCaches(qc, trackId, nextLiked);

            qc.setQueryData<unknown>(detailKey, (old: unknown) => {
                if (!old || typeof old !== 'object') return old;
                const o = old as Record<string, unknown>;
                if (o.isLikedByMe === nextLiked) return old;
                return { ...o, isLikedByMe: nextLiked };
            });

            return { snapshots };
        },

        onError: (_err, _vars, ctx) => {
            if (!ctx?.snapshots) return;
            for (const { key, data } of ctx.snapshots) {
                qc.setQueryData(key, data);
            }
        },

        onSettled: (_data, _err, vars) => {
            for (const prefix of INVALIDATE_PREFIXES) {
                qc.invalidateQueries({ queryKey: prefix as unknown[] });
            }
            qc.invalidateQueries({ queryKey: ['track', vars.trackId] });
        },
    });
}