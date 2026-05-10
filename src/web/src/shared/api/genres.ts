import { api } from './http';
import type { TrackListItem } from '@/shared/types';

export interface GenreItem {
    id: string;
    slug: string;
    displayName: string;
    trackCount?: number;
}

export async function listGenres(): Promise<GenreItem[]> {
    const r = await api.get<any[]>('/genres');
    return r.data.map(g => ({
        id: g.id ?? g.Id,
        slug: g.slug ?? g.Slug,
        displayName: g.displayName ?? g.DisplayName,
        trackCount: g.trackCount ?? g.TrackCount,
    }));
}

export interface GenreTracksResponse {
    genre: { id: string; slug: string; displayName: string };
    total: number;
    items: TrackListItem[];
}

export async function getGenreTracks(
    slug: string,
    opts: { skip?: number; take?: number; sort?: 'popular' | 'new' } = {},
): Promise<GenreTracksResponse> {
    const r = await api.get<any>(`/genres/${encodeURIComponent(slug)}/tracks`, {
        params: { skip: opts.skip ?? 0, take: opts.take ?? 30, sort: opts.sort ?? 'popular' },
    });
    const d = r.data;
    return {
        genre: {
            id: d.genre?.id ?? d.Genre?.Id,
            slug: d.genre?.slug ?? d.Genre?.Slug,
            displayName: d.genre?.displayName ?? d.Genre?.DisplayName,
        },
        total: d.total ?? d.Total ?? 0,
        items: (d.items ?? d.Items ?? []).map((t: any) => {
            const featRaw = t.featuredArtists ?? t.FeaturedArtists ?? [];
            return {
                id: t.id ?? t.Id,
                title: t.title ?? t.Title ?? '',
                artist: t.artist ?? t.Artist ?? null,
                duration: t.duration ?? t.Duration ?? null,
                uploadedAt: t.uploadedAt ?? t.UploadedAt ?? '',
                artistId: t.artistId ?? t.ArtistId ?? null,
                albumId: t.albumId ?? t.AlbumId ?? null,
                trackNumber: t.trackNumber ?? t.TrackNumber ?? null,
                isExplicit: t.isExplicit ?? t.IsExplicit ?? false,
                isLikedByMe: t.isLikedByMe ?? t.IsLikedByMe ?? false,
                coverUrl: t.coverUrl ?? t.CoverUrl ?? null,
                featuredArtists: Array.isArray(featRaw)
                    ? featRaw
                        .map((f: any) => ({ id: f?.id ?? f?.Id, name: f?.name ?? f?.Name ?? '' }))
                        .filter((f: { id?: string }) => !!f.id)
                    : [],
            } as TrackListItem;
        }),
    };
}