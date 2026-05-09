import { api } from './http';
import type {
    FeedItem,
    FollowedArtist,
    FollowedUser,
    FriendFeedItem,
    FriendItem,
    TrackListItem,
} from '@/shared/types';

function normalizeFeedTrack(t: any): TrackListItem {
    const featRaw = t?.featuredArtists ?? t?.FeaturedArtists ?? [];
    return {
        id: t?.id ?? t?.Id,
        title: t?.title ?? t?.Title ?? '',
        artist: t?.artist ?? t?.Artist ?? null,
        duration: t?.duration ?? t?.Duration ?? null,
        artistId: t?.artistId ?? t?.ArtistId ?? null,
        albumId: t?.albumId ?? t?.AlbumId ?? null,
        trackNumber: t?.trackNumber ?? t?.TrackNumber ?? null,
        uploadedAt: t?.uploadedAt ?? t?.UploadedAt ?? '',
        isExplicit: t?.isExplicit ?? t?.IsExplicit ?? false,
        isLikedByMe: t?.isLikedByMe ?? t?.IsLikedByMe ?? false,
        coverUrl: t?.coverUrl ?? t?.CoverUrl ?? null,
        featuredArtists: Array.isArray(featRaw)
            ? featRaw
                .map((f: any) => ({ id: f?.id ?? f?.Id, name: f?.name ?? f?.Name ?? '' }))
                .filter((f: { id?: string }) => !!f.id)
            : [],
    };
}

export async function followArtist(artistId: string): Promise<void> {
    await api.post(`/follows/artists/${artistId}`);
}

export async function unfollowArtist(artistId: string): Promise<void> {
    await api.delete(`/follows/artists/${artistId}`);
}

export async function listFollowedArtists(): Promise<FollowedArtist[]> {
    const r = await api.get<any[]>('/follows/artists');
    return r.data.map(a => ({
        artistId: a.artistId ?? a.ArtistId ?? a.id ?? a.Id,
        name: a.name ?? a.Name,
        followedAt: a.followedAt ?? a.FollowedAt ?? new Date().toISOString()
    }));
}

export async function getFeed(limit = 30): Promise<FeedItem[]> {
    const r = await api.get<any[]>('/follows/feed', { params: { limit } });
    return r.data.map((item) => {
        const featRaw = item.featuredArtists ?? item.FeaturedArtists ?? [];
        return {
            trackId: item.trackId ?? item.entityId ?? item.EntityId,
            title: item.title ?? item.Title,
            artist: item.artist ?? item.artistName ?? item.ArtistName ?? null,
            artistId: item.artistId ?? item.ArtistId ?? null,
            uploadedAt: item.uploadedAt ?? item.releasedAt ?? item.ReleasedAt ?? '',
            duration: item.duration ?? item.Duration ?? null,
            isLikedByMe: item.isLikedByMe ?? item.IsLikedByMe ?? false,
            coverUrl: item.coverUrl ?? item.CoverUrl ?? null,
            featuredArtists: Array.isArray(featRaw)
                ? featRaw
                    .map((f: any) => ({ id: f?.id ?? f?.Id, name: f?.name ?? f?.Name ?? '' }))
                    .filter((f: { id?: string }) => !!f.id)
                : [],
        };
    });
}

// User follows

export async function followUser(userId: string): Promise<void> {
    await api.post(`/follows/users/${userId}`);
}

export async function unfollowUser(userId: string): Promise<void> {
    await api.delete(`/follows/users/${userId}`);
}

export async function getFollowedUsers(): Promise<FollowedUser[]> {
    const r = await api.get<any[]>('/follows/users');
    return r.data.map(u => ({
        userId: u.userId ?? u.UserId ?? u.id ?? u.Id,
        isMutual: u.isMutual ?? u.IsMutual ?? false,
        subscribedAt: u.subscribedAt ?? u.SubscribedAt ?? new Date().toISOString()
    }));
}

export async function getFriends(): Promise<FriendItem[]> {
    const r = await api.get<FriendItem[]>('/follows/friends');
    return r.data;
}

export async function getFriendsFeed(take = 20): Promise<FriendFeedItem[]> {
    const r = await api.get<any[]>('/follows/friends/feed', { params: { take } });
    if (!Array.isArray(r.data)) return [];
    return r.data
        .map((item) => ({
            userId: item.userId ?? item.UserId,
            lastPlayedAt: item.lastPlayedAt ?? item.LastPlayedAt ?? '',
            track: normalizeFeedTrack(item.track ?? item.Track ?? {}),
        }))
        .filter((x) => !!x.userId && !!x.track.id);
}