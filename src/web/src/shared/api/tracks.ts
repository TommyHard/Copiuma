import { api } from './http';
import type { FavoriteItem, UploadResult } from '@/shared/types';

export interface UploadFields {
    title: string;
    artist?: string;
    artistId?: string;
    albumId?: string;
    trackNumber?: number;
    genres?: string[];
    featuredArtistIds?: string[];
}

export async function uploadTrack(
    file: File,
    fields: UploadFields,
    onProgress?: (percent: number) => void,
    signal?: AbortSignal,
): Promise<UploadResult> {
    const fd = new FormData();
    fd.append('File', file);
    fd.append('Title', fields.title);
    if (fields.artist) fd.append('Artist', fields.artist);
    if (fields.artistId) fd.append('ArtistId', fields.artistId);
    if (fields.albumId) fd.append('AlbumId', fields.albumId);
    if (fields.trackNumber !== undefined) fd.append('TrackNumber', String(fields.trackNumber));
    fields.genres?.forEach((g) => fd.append('Genres', g));
    fields.featuredArtistIds?.forEach((id) => fd.append('FeaturedArtistIds', id));

    const r = await api.post<UploadResult>('/tracks/upload', fd, {
        headers: { 'Content-Type': undefined },
        signal,
        onUploadProgress: (e) => {
            if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        },
    });
    return r.data;
}

export async function toggleLike(trackId: string): Promise<{ isLiked: boolean }> {
    const r = await api.post<{ isLiked: boolean }>(`/tracks/${trackId}/like`);
    return r.data;
}

export async function listFavorites(): Promise<FavoriteItem[]> {
    const r = await api.get<FavoriteItem[]>('/tracks/favorites');
    return r.data;
}

export async function deleteTrack(trackId: string): Promise<void> {
    await api.delete(`/tracks/${trackId}`);
}

export interface UpdateTrackFields {
    title: string;
    genres?: string[];
    isExplicit: boolean;
    featuredArtistIds?: string[];
}

export async function updateTrack(trackId: string, fields: UpdateTrackFields): Promise<void> {
    await api.put(`/tracks/${trackId}`, fields);
}

export async function reportPlayEvent(
    trackId: string,
    playedMs: number,
    completed: boolean,
): Promise<void> {
    await api.post(`/tracks/${trackId}/play-event`, { playedMs, completed });
}