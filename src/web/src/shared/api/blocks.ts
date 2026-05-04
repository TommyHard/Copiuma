import { api } from './http';

export interface BlockedArtistItem {
    artistId: string;
    name: string;
    avatarUrl?: string | null;
    createdAt: string;
}

export async function listBlockedArtists(): Promise<BlockedArtistItem[]> {
    const r = await api.get<BlockedArtistItem[]>('/blocks/artists');
    return r.data;
}

export async function blockArtist(artistId: string): Promise<void> {
    await api.post(`/blocks/artists/${artistId}`);
}

export async function unblockArtist(artistId: string): Promise<void> {
    await api.delete(`/blocks/artists/${artistId}`);
}