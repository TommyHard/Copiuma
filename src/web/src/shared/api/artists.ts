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

// GET /artists { total, items: ArtistListItem[] }
function unwrapArtistList(data: any): ArtistSummary[] {
    const items = Array.isArray(data) ? data : (data?.items ?? data?.Items ?? []);
    return items.map((a: any): ArtistSummary => ({
        id: a.id ?? a.Id,
        name: a.name ?? a.Name ?? '',
        avatarUrl: a.avatarUrl ?? a.AvatarUrl ?? null,
        albumCount: a.albumCount ?? a.AlbumCount,
        trackCount: a.trackCount ?? a.TrackCount,
    }));
}

export async function listArtists(skip = 0, take = 30): Promise<ArtistSummary[]> {
    const r = await api.get<any>('/artists', { params: { skip, take } });
    return unwrapArtistList(r.data);
}

export async function searchArtists(q: string): Promise<ArtistSummary[]> {
    if (q.trim().length < 2) return [];
    const r = await api.get<any>('/artists', { params: { q, take: 10 } });
    return unwrapArtistList(r.data);
}

export async function listArtistAlbums(artistId: string): Promise<AlbumSummary[]> {
    const r = await api.get<any[]>(`/artists/${artistId}/albums`);
    return Array.isArray(r.data) ? r.data.map(normalizeAlbumSummary) : [];
}

function normalizeArtistTrack(t: any): TrackListItem {
    const featRaw = t.featuredArtists ?? t.FeaturedArtists ?? [];
    return {
        id: t.id ?? t.Id,
        title: t.title ?? t.Title ?? '',
        artist: t.artist ?? t.Artist ?? null,
        duration: t.duration ?? t.Duration ?? null,
        artistId: t.artistId ?? t.ArtistId ?? null,
        albumId: t.albumId ?? t.AlbumId ?? null,
        trackNumber: t.trackNumber ?? t.TrackNumber ?? null,
        uploadedAt: t.uploadedAt ?? t.UploadedAt ?? '',
        isExplicit: t.isExplicit ?? t.IsExplicit ?? false,
        isLikedByMe: t.isLikedByMe ?? t.IsLikedByMe ?? false,
        isDislikedByMe: t.isDislikedByMe ?? t.IsDislikedByMe ?? false,
        coverUrl: t.coverUrl ?? t.CoverUrl ?? null,
        featuredArtists: Array.isArray(featRaw)
            ? featRaw
                .map((f: any) => ({ id: f?.id ?? f?.Id, name: f?.name ?? f?.Name ?? '' }))
                .filter((f: { id?: string }) => !!f.id)
            : [],
    };
}

function normalizeAlbumSummary(a: any): AlbumSummary {
    return {
        id: a.id ?? a.Id,
        title: a.title ?? a.Title ?? '',
        artistId: a.artistId ?? a.ArtistId,
        artistName: a.artistName ?? a.ArtistName ?? null,
        releasedAt: a.releasedAt ?? a.ReleasedAt ?? a.releaseDate ?? a.ReleaseDate ?? null,
        coverUrl: a.coverUrl ?? a.CoverUrl ?? null,
        trackCount: a.trackCount ?? a.TrackCount,
        ownerUserId: a.ownerUserId ?? a.OwnerUserId,
        createdAt: a.createdAt ?? a.CreatedAt ?? null,
        genres: a.genres ?? a.Genres ?? [],
    };
}

export async function listArtistTracks(artistId: string): Promise<TrackListItem[]> {
    const r = await api.get<any[]>(`/artists/${artistId}/tracks`);
    return Array.isArray(r.data) ? r.data.map(normalizeArtistTrack) : [];
}

export async function searchAlbums(q: string): Promise<AlbumSummary[]> {
    if (q.trim().length < 2) return [];
    const r = await api.get<any>('/albums/search', { params: { q, take: 10 } });
    const items = Array.isArray(r.data) ? r.data : (r.data?.items ?? []);
    return items.map(normalizeAlbumSummary);
}

/**
 * Треки, где артист отмечен как feat. (не основной исполнитель)
 */
export async function listArtistFeaturedOn(artistId: string): Promise<TrackListItem[]> {
    const r = await api.get<any[]>(`/artists/${artistId}/featured-on`);
    return Array.isArray(r.data) ? r.data.map(normalizeArtistTrack) : [];
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