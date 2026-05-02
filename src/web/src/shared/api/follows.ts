import { api } from './http';
import type { FeedItem, FollowedArtist, FollowedUser, FriendItem } from '@/shared/types';

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
    return r.data.map((item) => ({
        trackId: item.trackId ?? item.entityId,
        title: item.title,
        artist: item.artist ?? item.artistName ?? null,
        artistId: item.artistId ?? null,
        uploadedAt: item.uploadedAt ?? item.releasedAt ?? '',
        duration: item.duration ?? null,
    }));
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