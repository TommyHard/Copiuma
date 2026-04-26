import axios, { AxiosError, type AxiosRequestConfig, type AxiosInstance } from 'axios';
import { tokenStore } from '@/shared/lib/tokenStore';

let refreshInFlight: Promise<string | null> | null = null;

async function runRefresh(): Promise<string | null> {
    const refresh = tokenStore.getRefresh();
    if (!refresh) return null;

    try {
        const response = await axios.post<{ token: string; refreshToken: string }>(
            `${IDENTITY_BASE}/auth/refresh-token`,
            { refreshToken: refresh },
            { headers: { 'Content-Type': 'application/json' } },
        );
        tokenStore.set(response.data.token, response.data.refreshToken);
        return response.data.token;
    } catch {
        tokenStore.clear();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        return null;
    }
}

function refreshOnce(): Promise<string | null> {
    refreshInFlight ??= runRefresh().finally(() => {
        refreshInFlight = null;
    });
    return refreshInFlight;
}

const GATEWAY_BASE = (import.meta.env.VITE_GATEWAY_URL || '/api').replace(/\/$/, '');
const IDENTITY_BASE = (import.meta.env.VITE_IDENTITY_URL || '/identity').replace(/\/$/, '');

function createClient(baseURL: string): AxiosInstance {
    const instance = axios.create({
        baseURL,
        headers: { 'Content-Type': 'application/json' },
    });

    instance.interceptors.request.use((config) => {
        const access = tokenStore.getAccess();
        if (access && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${access}`;
        }
        return config;
    });

    instance.interceptors.response.use(
        (r) => r,
        async (error: AxiosError) => {
            const status = error.response?.status;
            const original = error.config as (AxiosRequestConfig & { __retried?: boolean }) | undefined;

            if (status !== 401 || !original || original.__retried) {
                throw error;
            }

            const isRefreshCall = original.url?.includes('/auth/refresh-token');
            if (isRefreshCall) throw error;

            const newToken = await refreshOnce();
            if (!newToken) throw error;

            original.__retried = true;
            original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
            return instance.request(original);
        },
    );

    return instance;
}

export const api = createClient(GATEWAY_BASE);
export const identity = createClient(IDENTITY_BASE);

export const httpEndpoints = {
    gateway: GATEWAY_BASE,
    identity: IDENTITY_BASE,
};