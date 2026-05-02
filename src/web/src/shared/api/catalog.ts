import { api } from './http';
import type {
    TrackDetail,
    TrackListItem,
    TrackProcessingStatusResponse,
    WaveformResponse,
} from '@/shared/types';

function normalizeTrack(t: any): TrackListItem {
    return {
        ...t,
        id: t.id ?? t.Id,
        title: t.title ?? t.Title,
        artist: t.artist ?? t.Artist ?? null,
        duration: t.duration ?? t.Duration ?? null,
        artistId: t.artistId ?? t.ArtistId ?? null,
        albumId: t.albumId ?? t.AlbumId ?? null,
        trackNumber: t.trackNumber ?? t.TrackNumber ?? null,
        uploadedAt: t.uploadedAt ?? t.UploadedAt ?? '',
        isExplicit: t.isExplicit ?? t.IsExplicit ?? false,
        isLikedByMe: t.isLikedByMe ?? t.IsLikedByMe ?? false,
        featuredArtists: t.featuredArtists ?? t.FeaturedArtists ?? [],
    };
}

export async function listTracks(page = 1, pageSize = 20): Promise<TrackListItem[]> {
    const r = await api.get<any[]>('/tracks', { params: { page, pageSize } });
    return r.data.map(normalizeTrack);
}

export async function searchTracks(q: string): Promise<TrackListItem[]> {
    const r = await api.get<any[]>('/tracks/search', { params: { q } });
    return r.data.map(normalizeTrack);
}

export async function getTrack(id: string): Promise<TrackDetail> {
    const r = await api.get<TrackDetail>(`/tracks/${id}`);
    return r.data;
}

export async function getTrackStatus(id: string): Promise<TrackProcessingStatusResponse> {
    const r = await api.get<TrackProcessingStatusResponse>(`/tracks/${id}/status`);
    return r.data;
}

export async function getWaveform(id: string): Promise<WaveformResponse> {
    const r = await api.get<WaveformResponse>(`/tracks/${id}/waveform`);
    return r.data;
}

export function hlsMasterUrl(trackId: string): string {
    const base = (import.meta.env.VITE_GATEWAY_URL || '/api').replace(/\/$/, '');
    return `${base}/tracks/${trackId}/hls/master.m3u8`;
}