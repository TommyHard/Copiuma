import { api } from './http';
import type { HistoryArtistEntry, HistoryTrackEntry, RawPlayEvent } from '@/shared/types';

/**
 * /history
 * GET /tracks   — недавние треки (сгруппированы, по дате последнего проигрывания)
 * GET /artists  — недавние артисты
 * DELETE        — очистить всю историю
 */

export async function recentTracks(page = 1, limit = 20): Promise<HistoryTrackEntry[]> {
    const r = await api.get<HistoryTrackEntry[]>('/history/tracks', {
        params: { page, limit }
    });
    return r.data;
}

export async function recentArtists(limit = 30): Promise<HistoryArtistEntry[]> {
    const r = await api.get<HistoryArtistEntry[]>('/history/artists', {
        params: { limit }
    });
    return r.data;
}

export async function clearHistory(): Promise<void> {
    await api.delete('/history');
}

/**
 * Лента прослушиваний без дедупликации
 * GET /history/tracks/raw
 */
export async function rawHistory(page = 1, limit = 20, sinceDays = 30): Promise<RawPlayEvent[]> {
    const r = await api.get<RawPlayEvent[]>('/history/tracks/raw', {
        params: { page, limit, sinceDays }
    });
    return r.data;
}