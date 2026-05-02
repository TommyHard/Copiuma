import { api } from './http';
import type { AlbumSummary, TrackListItem } from '@/shared/types';

function normalizeAlbum(a: any): AlbumSummary {
    return {
        id: a.id ?? a.Id,
        title: a.title ?? a.Title ?? '',
        artistId: a.artistId ?? a.ArtistId,
        artistName: a.artistName ?? a.ArtistName ?? null,
        releasedAt: a.releaseDate ?? a.ReleaseDate ?? a.releasedAt ?? null,
        coverUrl: a.coverUrl ?? a.CoverUrl ?? null,
        trackCount: a.trackCount ?? a.TrackCount ?? 0,
        ownerUserId: a.createdByUserId ?? a.CreatedByUserId ?? a.ownerUserId,
        createdAt: a.createdAt ?? a.CreatedAt ?? null,
        genres: a.genres ?? a.Genres ?? [],
    };
}

export async function getAlbum(id: string): Promise<AlbumSummary> {
    const r = await api.get<any>(`/albums/${id}`);
    return normalizeAlbum(r.data);
}

export interface UpdateAlbumPayload {
    title?: string;
    releaseDate?: string | null;  // YYYY-MM-DD
    genres?: string[];
}

export async function updateAlbum(id: string, payload: UpdateAlbumPayload): Promise<AlbumSummary> {
    const r = await api.put<any>(`/albums/${id}`, payload);
    return normalizeAlbum(r.data);
}

export async function deleteAlbum(id: string): Promise<void> {
    await api.delete(`/albums/${id}`);
}

export async function listAlbumTracks(id: string): Promise<TrackListItem[]> {
    const r = await api.get<any[]>(`/albums/${id}/tracks`);
    return r.data.map((t) => ({
        id: t.id ?? t.Id,
        title: t.title ?? t.Title ?? '',
        artist: t.artist ?? t.Artist ?? null,
        duration: t.duration ?? t.Duration ?? null,
        uploadedAt: t.uploadedAt ?? t.UploadedAt ?? '',
        artistId: t.artistId ?? t.ArtistId ?? null,
        albumId: t.albumId ?? t.AlbumId ?? id,
        trackNumber: t.trackNumber ?? t.TrackNumber ?? null,
        isExplicit: t.isExplicit ?? t.IsExplicit ?? false,
        coverUrl: t.coverUrl ?? t.CoverUrl ?? null,
    }));
}

export interface CreateAlbumPayload {
    artistId: string;
    title: string;
    releaseDate?: string | null;  // YYYY-MM-DD
    genres?: string[];
}

export async function createAlbum(payload: CreateAlbumPayload): Promise<AlbumSummary> {
    const r = await api.post<any>('/albums', payload);
    return normalizeAlbum(r.data);
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