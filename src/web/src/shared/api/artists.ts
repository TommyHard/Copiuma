import { api } from './http';
import type { AlbumSummary, ArtistSummary, TrackListItem } from '@/shared/types';

export async function getArtist(id: string): Promise<ArtistSummary> {
    const r = await api.get<ArtistSummary>(`/artists/${id}`);
    return r.data;
}

export async function listArtists(page = 1, pageSize = 30): Promise<ArtistSummary[]> {
    const r = await api.get<ArtistSummary[]>('/artists', { params: { page, pageSize } });
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