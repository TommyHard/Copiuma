import { api } from './http';
import type { UserSearchResult } from '@/shared/types';

/**
 * GET /api/users/search?q=
 * Поиск по displayName или email
 */
export async function searchUsers(q: string): Promise<UserSearchResult[]> {
    if (q.trim().length < 2) return [];
    const r = await api.get<UserSearchResult[]>('/users/search', { params: { q } });
    return r.data;
}

/**
 * GET /api/users/batch?ids=uuid1,uuid2
 */
export async function batchUsers(ids: string[]): Promise<UserSearchResult[]> {
    if (ids.length === 0) return [];
    const r = await api.get<UserSearchResult[]>('/users/batch', { params: { ids: ids.join(',') } });
    return r.data;
}