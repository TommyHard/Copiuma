import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toggleLike } from '@/shared/api/tracks';
import type { FavoriteItem, FriendFeedItem, TrackListItem } from '@/shared/types';

/**
 * Префиксы query-ключей, в данных которых может встречаться трек с полем isLikedByMe
 */
const TRACK_LIST_QUERY_PREFIXES: readonly (readonly unknown[])[] = [
    ['catalog'],
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

/**
 * Применяем нужное значение isLikedByMe ко всем кэшам, где попадается trackId
 */
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

/**
 * Возвращает { value, changed }
 *
 * Поддерживаем формы:
 *  - TrackListItem[] (catalog/popular/for-you/similar/artist-tracks/)
 *  - FavoriteItem[]: либо удаляем (если становится unliked), либо ничего (favorites не имеет isLikedByMe)
 *  - FriendFeedItem[] — правим item.track.isLikedByMe
 *  - SearchResults { tracks, albums, artists }
 *  - TrackDetail (одиночный объект с id)
 */
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

            // Обычный TrackListItem (HistoryRaw, HistoryTracks, Catalog и т.д.)
            if (obj.id === trackId && obj.isLikedByMe !== nextValue) {
                changed = true;
                return { ...obj, isLikedByMe: nextValue };
            }

            // PlaylistTrack и HistoryTrackItem
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

/**
 * Хук для кнопки "В избранное". Делает апдейт
 * по всем кэшам (heart мгновенно обновляется на всех страницах,
 * где встречается тот же track) + инвалидирует списки
 */
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