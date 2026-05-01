import { api } from './http';

export interface GenreItem {
    id: string;
    slug: string;
    displayName: string;
}

export async function listGenres(): Promise<GenreItem[]> {
    const r = await api.get<GenreItem[]>('/genres');
    return r.data;
}