import { identity } from './http';
import { tokenStore } from '@/shared/lib/tokenStore';
import type { SessionResponse } from '@/shared/types';

/**
 * Все вызовы прокидывают X-Refresh-Token, чтобы backend подсветил текущую сессию
 */
function refreshHeader() {
    const refresh = tokenStore.getRefresh();
    return refresh ? { 'X-Refresh-Token': refresh } : undefined;
}

export async function listSessions(): Promise<SessionResponse[]> {
    const r = await identity.get<SessionResponse[]>('/auth/sessions', { headers: refreshHeader() });
    return r.data;
}

export async function revokeSession(id: string) {
    await identity.delete(`/auth/sessions/${id}`, { headers: refreshHeader() });
}

export async function revokeAllOtherSessions() {
    await identity.delete('/auth/sessions', { headers: refreshHeader() });
}