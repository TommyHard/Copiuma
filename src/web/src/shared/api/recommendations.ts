import { api } from './http';
import type { ArtistSummary, TrackListItem } from '@/shared/types';

export async function popularTracks(limit = 20): Promise<TrackListItem[]> {
    const r = await api.get<TrackListItem[]>('/recommendations/popular', { params: { limit } });
    return r.data;
}

export async function similarTracks(trackId: string, limit = 10): Promise<TrackListItem[]> {
    const r = await api.get<TrackListItem[]>(`/recommendations/similar/${trackId}`, { params: { limit } });
    return r.data;
}

export async function forYouTracks(limit = 20): Promise<TrackListItem[]> {
    const r = await api.get<TrackListItem[]>('/recommendations/for-you', { params: { limit } });
    return r.data;
}

export async function trendingArtists(limit = 12): Promise<ArtistSummary[]> {
    const r = await api.get<ArtistSummary[]>('/recommendations/artists/trending', { params: { limit } });
    return r.data;
}