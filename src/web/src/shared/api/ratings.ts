import { api } from './http';
import type { TrackRatingResponse } from '@/shared/types';

/**
 * /tracks/{id}/rating  — GET / PUT / DELETE
 *   PUT body: { value: 1-5 }
 *   возвращает агрегаты + ваш голос
 */

export async function getRating(trackId: string): Promise<TrackRatingResponse> {
    const r = await api.get<TrackRatingResponse>(`/tracks/${trackId}/rating`);
    return r.data;
}

export async function setRating(trackId: string, value: number): Promise<TrackRatingResponse> {
    const r = await api.put<TrackRatingResponse>(`/tracks/${trackId}/rating`, { value });
    return r.data;
}

export async function clearRating(trackId: string): Promise<TrackRatingResponse> {
    const r = await api.delete<TrackRatingResponse>(`/tracks/${trackId}/rating`);
    return r.data;
}