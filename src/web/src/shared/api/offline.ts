import { api } from './http';

export interface OfflineTrackItem {
    trackId: string;
    source: string;
    addedAt: string;
    lastDownloadedAt: string | null;
    title: string;
    artist: string | null;
    duration: string | null;
    artistId: string | null;
    albumId: string | null;
    fileKey: string | null;
}

function normalize(t: any): OfflineTrackItem {
    return {
        trackId: t.trackId ?? t.TrackId,
        source: t.source ?? t.Source ?? 'single',
        addedAt: t.addedAt ?? t.AddedAt ?? '',
        lastDownloadedAt: t.lastDownloadedAt ?? t.LastDownloadedAt ?? null,
        title: t.title ?? t.Title ?? '',
        artist: t.artist ?? t.Artist ?? null,
        duration: t.duration ?? t.Duration ?? null,
        artistId: t.artistId ?? t.ArtistId ?? null,
        albumId: t.albumId ?? t.AlbumId ?? null,
        fileKey: t.fileKey ?? t.FileKey ?? null,
    };
}

export async function listOfflineTracks(): Promise<OfflineTrackItem[]> {
    const r = await api.get<any[]>('/offline');
    return Array.isArray(r.data) ? r.data.map(normalize) : [];
}

export async function addOfflineTrack(trackId: string): Promise<void> {
    await api.post(`/offline/tracks/${trackId}`);
}

export async function removeOfflineTrack(trackId: string): Promise<void> {
    await api.delete(`/offline/tracks/${trackId}`);
}

export async function markOfflineDownloaded(trackId: string): Promise<void> {
    await api.post(`/offline/tracks/${trackId}/downloaded`);
}

export async function addOfflineFromPlaylist(playlistId: string): Promise<{ added: number; total: number }> {
    const r = await api.post<{ added: number; total: number; Added?: number; Total?: number }>(
        `/offline/playlists/${playlistId}`,
    );
    return {
        added: r.data.added ?? r.data.Added ?? 0,
        total: r.data.total ?? r.data.Total ?? 0,
    };
}

export async function removeOfflineFromPlaylist(playlistId: string): Promise<{ removed: number }> {
    const r = await api.delete<{ removed: number; Removed?: number }>(
        `/offline/playlists/${playlistId}`,
    );
    return { removed: r.data.removed ?? r.data.Removed ?? 0 };
}

export async function addOfflineFromAlbum(albumId: string): Promise<{ added: number; total: number }> {
    const r = await api.post<{ added: number; total: number; Added?: number; Total?: number }>(
        `/offline/albums/${albumId}`,
    );
    return {
        added: r.data.added ?? r.data.Added ?? 0,
        total: r.data.total ?? r.data.Total ?? 0,
    };
}

export async function removeOfflineFromAlbum(albumId: string): Promise<{ removed: number }> {
    const r = await api.delete<{ removed: number; Removed?: number }>(
        `/offline/albums/${albumId}`,
    );
    return { removed: r.data.removed ?? r.data.Removed ?? 0 };
}