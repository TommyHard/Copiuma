import { api } from './http';
import type { HistoryArtistEntry, HistoryTrackEntry, RawPlayEvent } from '@/shared/types';


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

/**
 * Лента прослушиваний без дедупликации
 * GET /history/tracks/raw
 */
export async function rawHistory(take = 100, sinceDays = 30): Promise<RawPlayEvent[]> {
    const r = await api.get<RawPlayEvent[]>('/history/tracks/raw', { params: { take, sinceDays } });
    return r.data;
}