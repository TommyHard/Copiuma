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

/**
 * загрузка обложки альбома. Backend "POST /albums/{id}/cover" принимает
 * multipart с файлом. Возвращает обновлённый AlbumSummary с coverUrl
 */
export async function uploadAlbumCover(albumId: string, file: File): Promise<AlbumSummary> {
    const fd = new FormData();
    fd.append('file', file);
    const r = await api.post<AlbumSummary>(`/albums/${albumId}/cover`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
}

export async function deleteAlbumCover(albumId: string): Promise<AlbumSummary> {
    const r = await api.delete<AlbumSummary>(`/albums/${albumId}/cover`);
    return r.data;
}