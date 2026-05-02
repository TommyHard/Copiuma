import { api } from './http';
import type { FeedItem, FollowedArtist, FollowedUser, FriendItem } from '@/shared/types';

export async function followArtist(artistId: string): Promise<void> {
    await api.post(`/follows/artists/${artistId}`);
}

export async function unfollowArtist(artistId: string): Promise<void> {
    await api.delete(`/follows/artists/${artistId}`);
}

export async function listFollowedArtists(): Promise<FollowedArtist[]> {
    const r = await api.get<FollowedArtist[]>('/follows/artists');
    return r.data;
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
    const r = await api.get<FollowedUser[]>('/follows/users');
    return r.data;
}

export async function getFriends(): Promise<FriendItem[]> {
    const r = await api.get<FriendItem[]>('/follows/friends');
    return r.data;
}