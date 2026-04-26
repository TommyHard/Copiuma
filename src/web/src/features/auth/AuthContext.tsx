import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { tokenStore } from '@/shared/lib/tokenStore';
import * as authApi from '@/shared/api/auth';
import { getMe } from '@/shared/api/me';
import type { MeResponse } from '@/shared/types';

export interface AuthState {
    status: 'loading' | 'authenticated' | 'unauthenticated';
    user: MeResponse | null;

    login(email: string, password: string, deviceLabel?: string): Promise<void>;
    logout(): Promise<void>;
    refreshUser(): Promise<void>;
    setSessionFromTokens(accessToken: string, refreshToken: string): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<MeResponse | null>(null);
    const [status, setStatus] = useState<AuthState['status']>('loading');

    const refreshUser = useCallback(async () => {
        if (!tokenStore.getAccess()) {
            setUser(null);
            setStatus('unauthenticated');
            return;
        }
        try {
            const me = await getMe();
            setUser(me);
            setStatus('authenticated');
        } catch {
            tokenStore.clear();
            setUser(null);
            setStatus('unauthenticated');
        }
    }, []);

    useEffect(() => {
        void refreshUser();
    }, [refreshUser]);

    useEffect(() => {
        function onLogout() {
            setUser(null);
            setStatus('unauthenticated');
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
            }
        }
        tokenStore.clear();
        setUser(null);
        setStatus('unauthenticated');
    }, []);

    const setSessionFromTokens = useCallback(
        async (accessToken: string, refreshToken: string) => {
            tokenStore.set(accessToken, refreshToken);
            await refreshUser();
        },
        [refreshUser],
    );

    const value = useMemo<AuthState>(
        () => ({ status, user, login, logout, refreshUser, setSessionFromTokens }),
        [status, user, login, logout, refreshUser, setSessionFromTokens],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}