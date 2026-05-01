import { api } from './http';
import type { UserSearchResult } from '@/shared/types';

/**
 * GET /api/users/search?q=
 */
export async function searchUsers(q: string): Promise<UserSearchResult[]> {
    if (q.trim().length < 2) return [];
    const r = await api.get<UserSearchResult[]>('/users/search', { params: { q } });
    return r.data;
}