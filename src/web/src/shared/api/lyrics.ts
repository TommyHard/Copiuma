import { api } from './http';

/**
 * Получить LRC-текст трека. null = текст не загружен
 */
export async function getLyrics(trackId: string): Promise<string | null> {
    try {
        const r = await api.get<{ trackId: string; lyrics: string }>(`/tracks/${trackId}/lyrics`, {
            validateStatus: (s) => s === 200 || s === 204 || s === 404,
        });
        if (r.status !== 200) return null;
        return r.data.lyrics ?? null;
    } catch {
        return null;
    }
}

export async function setLyrics(trackId: string, lyrics: string): Promise<void> {
    await api.put(`/tracks/${trackId}/lyrics`, { lyrics });
}

export async function deleteLyrics(trackId: string): Promise<void> {
    await api.delete(`/tracks/${trackId}/lyrics`);
}