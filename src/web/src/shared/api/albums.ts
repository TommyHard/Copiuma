import { api } from './http';
import type { AlbumSummary, TrackListItem } from '@/shared/types';

export async function getAlbum(id: string): Promise<AlbumSummary> {
    const r = await api.get<AlbumSummary>(`/albums/${id}`);
    return r.data;
}

export async function listAlbumTracks(id: string): Promise<TrackListItem[]> {
    const r = await api.get<TrackListItem[]>(`/albums/${id}/tracks`);
    return r.data;
}

export async function listAlbums(page = 1, pageSize = 30): Promise<AlbumSummary[]> {
    const r = await api.get<AlbumSummary[]>('/albums', { params: { page, pageSize } });
    return r.data;
}