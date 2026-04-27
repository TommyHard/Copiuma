import { api } from './http';
import type { FeedItem, FollowedArtist } from '@/shared/types';

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
    const r = await api.get<FeedItem[]>('/follows/feed', { params: { limit } });
    return r.data;
}