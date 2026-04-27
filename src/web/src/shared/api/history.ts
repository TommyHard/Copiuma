import { api } from './http';
import type { HistoryArtistEntry, HistoryTrackEntry } from '@/shared/types';

/**
 * /history
 *   GET /tracks   — недавние треки (сгруппированы, по дате последнего проигрывания)
 *   GET /artists  — недавние артисты
 *   DELETE        — очистить всю историю
 */

export async function recentTracks(limit = 50): Promise<HistoryTrackEntry[]> {
    const r = await api.get<HistoryTrackEntry[]>('/history/tracks', { params: { limit } });
    return r.data;
}

export async function recentArtists(limit = 30): Promise<HistoryArtistEntry[]> {
    const r = await api.get<HistoryArtistEntry[]>('/history/artists', { params: { limit } });
    return r.data;
}

export async function clearHistory(): Promise<void> {
    await api.delete('/history');
}