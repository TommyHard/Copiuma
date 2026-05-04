import { api } from './http';

export async function blockArtist(artistId: string): Promise<void> {
    await api.post(`/blocks/artists/${artistId}`);
}

export async function unblockArtist(artistId: string): Promise<void> {
    await api.delete(`/blocks/artists/${artistId}`);
}