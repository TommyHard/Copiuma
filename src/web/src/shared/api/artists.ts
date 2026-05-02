import { api } from './http';
import type { AlbumSummary, ArtistSummary, TrackListItem } from '@/shared/types';

export async function getArtist(id: string): Promise<ArtistSummary> {
    const r = await api.get<ArtistSummary>(`/artists/${id}`);
    return r.data;
}

export async function createArtist(data: { name: string; bio?: string }): Promise<ArtistSummary> {
    const r = await api.post<ArtistSummary>('/artists', data);
    return r.data;
}

export async function getMyArtist(): Promise<ArtistSummary | null> {
    const r = await api.get<ArtistSummary>('/artists/mine', { validateStatus: (s) => s === 200 || s === 204 });
    return r.status === 204 ? null : r.data;
}

export async function listArtists(page = 1, pageSize = 30): Promise<ArtistSummary[]> {
    const r = await api.get<ArtistSummary[]>('/artists', { params: { page, pageSize } });
    return r.data;
}

export async function searchArtists(q: string): Promise<ArtistSummary[]> {
    if (q.trim().length < 2) return [];
    const r = await api.get<ArtistSummary[]>('/artists', { params: { q, take: 10 } });
    return r.data;
}

export async function listArtistAlbums(artistId: string): Promise<AlbumSummary[]> {
    const r = await api.get<AlbumSummary[]>(`/artists/${artistId}/albums`);
    return r.data;
}

export async function listArtistTracks(artistId: string): Promise<TrackListItem[]> {
    const r = await api.get<TrackListItem[]>(`/artists/${artistId}/tracks`);
    return r.data;
}

/**
 * аватар артиста. Backend "POST /artists/{id}/avatar", multipart
 */

export async function uploadArtistAvatar(artistId: string, file: File): Promise<ArtistSummary> {
    const fd = new FormData();
    fd.append('file', file);
    const r = await api.post<ArtistSummary>(`/artists/${artistId}/avatar`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
}

export async function deleteArtistAvatar(artistId: string): Promise<ArtistSummary> {
    const r = await api.delete<ArtistSummary>(`/artists/${artistId}/avatar`);
    return r.data;
}

export async function uploadArtistBanner(artistId: string, file: File): Promise<ArtistSummary> {
    const fd = new FormData();
    fd.append('file', file);
    const r = await api.post<ArtistSummary>(`/artists/${artistId}/banner`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
}

export async function deleteArtistBanner(artistId: string): Promise<ArtistSummary> {
    const r = await api.delete<ArtistSummary>(`/artists/${artistId}/banner`);
    return r.data;
}

export async function updateArtist(artistId: string, data: { name?: string; bio?: string }): Promise<ArtistSummary> {
    const r = await api.put<ArtistSummary>(`/artists/${artistId}`, data);
    return r.data;
}