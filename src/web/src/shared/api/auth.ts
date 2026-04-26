import { identity } from './http';
import type { LoginResponse } from '@/shared/types';

/**
 * Все обращения к Identity.API/auth/*
 */

export async function register(email: string, password: string, displayName?: string) {
    const r = await identity.post<{ message: string }>('/auth/register', {
        email,
        password,
        displayName,
    });
    return r.data;
}

export async function login(email: string, password: string, deviceLabel?: string): Promise<LoginResponse> {
    const r = await identity.post<LoginResponse>(
        `/auth/login${deviceLabel ? `?deviceLabel=${encodeURIComponent(deviceLabel)}` : ''}`,
        { email, password },
    );
    return r.data;
}

export async function logout(refreshToken: string) {
    await identity.post('/auth/logout', { refreshToken });
}

export async function logoutAll(refreshToken: string) {
    await identity.post('/auth/logout-all', { refreshToken });
}

export async function verifyEmail(token: string) {
    const r = await identity.post<{ message: string }>('/auth/verify-email', { token });
    return r.data;
}

export async function resendVerification(email: string) {
    await identity.post('/auth/resend-verification', { email });
}

export async function forgotPassword(email: string) {
    await identity.post('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, newPassword: string) {
    const r = await identity.post<{ message: string }>('/auth/reset-password', {
        token,
        newPassword,
    });
    return r.data;
}

// ---- PKCE / device flow

export async function deviceAuthorize(payload: {
    clientId: string;
    redirectUri: string;
    codeChallenge: string;
    codeChallengeMethod: 'S256';
    state?: string;
    deviceLabel?: string;
}) {
    const r = await identity.post<{ code: string; redirectTo: string }>(
        '/auth/device/authorize',
        payload,
    );
    return r.data;
}