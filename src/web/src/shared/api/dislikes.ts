import { api } from './http';

export async function dislikeTrack(trackId: string): Promise<void> {
    await api.post(`/dislikes/tracks/${trackId}`);
}

export async function undoDislikeTrack(trackId: string): Promise<void> {
    await api.delete(`/dislikes/tracks/${trackId}`);
}

export async function dislikeArtist(artistId: string): Promise<void> {
    await api.post(`/dislikes/artists/${artistId}`);
}

export async function undoDislikeArtist(artistId: string): Promise<void> {
    await api.delete(`/dislikes/artists/${artistId}`);
}

export interface DislikeItem {
    targetType: 'Track' | 'Artist';
    targetId: string;
    createdAt: string;
}

export async function listDislikes(): Promise<DislikeItem[]> {
    const r = await api.get<DislikeItem[]>('/dislikes');
    return r.data;
}