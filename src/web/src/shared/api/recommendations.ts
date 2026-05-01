import { api } from './http';
import type { ArtistSummary, TrackListItem } from '@/shared/types';

function normalizeRec(t: any): TrackListItem {
    return {
        id: t.id ?? t.trackId ?? t.Id ?? t.TrackId,
        title: t.title ?? t.Title ?? '',
        artist: t.artist ?? t.Artist ?? null,
        duration: t.duration ?? t.Duration ?? null,
        artistId: t.artistId ?? t.ArtistId ?? null,
        albumId: t.albumId ?? t.AlbumId ?? null,
        trackNumber: t.trackNumber ?? t.TrackNumber ?? null,
        uploadedAt: t.uploadedAt ?? t.UploadedAt ?? '',
        isExplicit: t.isExplicit ?? t.IsExplicit ?? false,
        isLikedByMe: t.isLikedByMe ?? t.IsLikedByMe ?? false,
    };
}

export async function popularTracks(limit = 20): Promise<TrackListItem[]> {
    const r = await api.get<any[]>('/recommendations/popular', { params: { limit } });
    return r.data.map(normalizeRec);
}

export async function similarTracks(trackId: string, limit = 10): Promise<TrackListItem[]> {
    const r = await api.get<any[]>(`/recommendations/similar/${trackId}`, { params: { limit } });
    return r.data.map(normalizeRec);
}

export async function forYouTracks(limit = 20): Promise<TrackListItem[]> {
    const r = await api.get<any[]>('/recommendations/for-you', { params: { limit } });
    return r.data.map(normalizeRec);
}

export async function trendingArtists(limit = 12): Promise<ArtistSummary[]> {
    const r = await api.get<ArtistSummary[]>('/recommendations/artists/trending', { params: { limit } });
    return r.data;
}