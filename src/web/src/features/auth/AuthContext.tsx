import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { tokenStore } from '@/shared/lib/tokenStore';
import { cacheMe, clearCachedMe, readCachedMe } from '@/shared/lib/offlineUserCache';
import * as authApi from '@/shared/api/auth';
import { getMe } from '@/shared/api/me';
import type { MeResponse } from '@/shared/types';

export interface AuthState {
    status: 'loading' | 'authenticated' | 'unauthenticated';
    user: MeResponse | null;
    isOffline: boolean;

    login(email: string, password: string, deviceLabel?: string): Promise<void>;
    logout(): Promise<void>;
    refreshUser(): Promise<void>;
    setSessionFromTokens(accessToken: string, refreshToken: string): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

function isAuthError(err: unknown): boolean {
    const code = (err as any)?.response?.status;
    return code === 401 || code === 403;
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<MeResponse | null>(null);
    const [status, setStatus] = useState<AuthState['status']>('loading');
    const [isOffline, setIsOffline] = useState(false);

    const refreshUser = useCallback(async () => {
        if (!tokenStore.getAccess()) {
            setUser(null);
            setStatus('unauthenticated');
            setIsOffline(false);
            clearCachedMe();
            return;
        }
        try {
            const me = await getMe();
            setUser(me);
            setStatus('authenticated');
            setIsOffline(false);
            cacheMe(me);
        } catch (err) {
            if (isAuthError(err)) {
                // Сессия точно невалидна — выкидываем
                tokenStore.clear();
                clearCachedMe();
                setUser(null);
                setStatus('unauthenticated');
                setIsOffline(false);
                return;
            }
            // Сервер не отвечает / сеть лежит — используем последний снапшот
            const cached = readCachedMe();
            if (cached) {
                setUser(cached);
                setStatus('authenticated');
                setIsOffline(true);
            } else {
                // Нет кэша — пускать в приложение нечем
                setUser(null);
                setStatus('unauthenticated');
                setIsOffline(false);
            }
        }
    }, []);

    useEffect(() => {
        void refreshUser();
    }, [refreshUser]);

    // Когда сеть вернулась — пробуем снова валидировать сессию
    useEffect(() => {
        function onOnline() {
            if (isOffline) void refreshUser();
        }
        window.addEventListener('online', onOnline);
        return () => window.removeEventListener('online', onOnline);
    }, [isOffline, refreshUser]);

    useEffect(() => {
        function onLogout() {
            clearCachedMe();
            setUser(null);
            setStatus('unauthenticated');
            setIsOffline(false);
        }
        window.addEventListener('auth:logout', onLogout);
        return () => window.removeEventListener('auth:logout', onLogout);
    }, []);

    const login = useCallback(
        async (email: string, password: string, deviceLabel?: string) => {
            const r = await authApi.login(email, password, deviceLabel);
            tokenStore.set(r.token, r.refreshToken);
            await refreshUser();
        },
        [refreshUser],
    );

    const logout = useCallback(async () => {
        const refresh = tokenStore.getRefresh();
        if (refresh) {
            try {
                await authApi.logout(refresh);
            } catch {
                /* ignore */
            }
        }
        tokenStore.clear();
        clearCachedMe();
        setUser(null);
        setStatus('unauthenticated');
        setIsOffline(false);
    }, []);

    const setSessionFromTokens = useCallback(
        async (accessToken: string, refreshToken: string) => {
            tokenStore.set(accessToken, refreshToken);
            await refreshUser();
        },
        [refreshUser],
    );

    const value = useMemo<AuthState>(
        () => ({ status, user, isOffline, login, logout, refreshUser, setSessionFromTokens }),
        [status, user, isOffline, login, logout, refreshUser, setSessionFromTokens],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
