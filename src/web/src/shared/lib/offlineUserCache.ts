import type { MeResponse, UserRole } from '@/shared/types';

/**
 * —напшот текущего пользовател€ в localStorage Ч на случай, когда сервер
 * недоступен и хотим оставить пользовател€ log. в офлайн-режиме
 * (чтобы открылс€ /offline и заработал плеер)
 *
 *  люч хранени€ отличаетс€ от server-data, чтобы выход не оставл€л мусора
 * ќчищаетс€ на logout и при получении 401/403 (валидный signal протухшей сессии)
 */

const KEY = 'cw:me';

export function cacheMe(me: MeResponse): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(me));
    } catch { /* ignore */ }
}

export function readCachedMe(): MeResponse | null {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<MeResponse>;
        if (!parsed?.id || !parsed?.email) return null;
        return {
            id: parsed.id,
            email: parsed.email,
            displayName: parsed.displayName ?? null,
            role: (parsed.role ?? 'User') as UserRole,
            emailVerified: !!parsed.emailVerified,
            createdAt: parsed.createdAt ?? new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

export function clearCachedMe(): void {
    try {
        localStorage.removeItem(KEY);
    } catch { /* ignore */ }
}