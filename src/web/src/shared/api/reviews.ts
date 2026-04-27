import { api } from './http';
import type { ReviewItem } from '@/shared/types';

/**
 * Backend:
 *   GET    /tracks/{id}/reviews              — список (with optional pagination)
 *   POST   /tracks/{id}/reviews              — создать (или 409 если уже есть)
 *   PUT    /reviews/{id}                     — править свой
 *   DELETE /reviews/{id}                     — удалить свой / модер
 *   POST   /reviews/{id}/like                — toggle like
 *   DELETE /reviews/{id}/like
 */

export async function listReviews(trackId: string): Promise<ReviewItem[]> {
    const r = await api.get<ReviewItem[]>(`/tracks/${trackId}/reviews`);
    return r.data;
}

export async function createReview(trackId: string, text: string): Promise<ReviewItem> {
    const r = await api.post<ReviewItem>(`/tracks/${trackId}/reviews`, { text });
    return r.data;
}

export async function updateReview(reviewId: string, text: string): Promise<ReviewItem> {
    const r = await api.put<ReviewItem>(`/reviews/${reviewId}`, { text });
    return r.data;
}

export async function deleteReview(reviewId: string): Promise<void> {
    await api.delete(`/reviews/${reviewId}`);
}

export async function likeReview(reviewId: string): Promise<void> {
    await api.post(`/reviews/${reviewId}/like`);
}

export async function unlikeReview(reviewId: string): Promise<void> {
    await api.delete(`/reviews/${reviewId}/like`);
}