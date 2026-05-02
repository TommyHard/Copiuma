/**
 * Операции с профилем пользователя
 * /api/profile/* -> Identity.API /profile/*
 * /api/user-profile/* -> Music.API /user-profile/*
 */
import { api } from './http';
import type { UserProfile, PublicUserProfile } from '@/shared/types';

export async function getProfile(): Promise<UserProfile> {
    const r = await api.get<UserProfile>('/profile');
    return r.data;
}

export interface UpdateProfilePayload {
    displayName?: string;
    bio?: string;
    favoriteGenres: string[];
    language: string;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
    const r = await api.put<UserProfile>('/profile', payload);
    return r.data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/profile/change-password', { currentPassword, newPassword });
}

// Профиль
// GET /api/users/{id} -> Identity.API (инфо)
// GET /api/user-profile/{id}/stats -> Music.API (статистика)

export async function getPublicUserProfile(userId: string): Promise<PublicUserProfile> {
    const identityResp = await api.get<{
        id: string;
        displayName: string;
        bio: string | null;
        avatarKey: string | null;
        favoriteGenres: string[];
    }>(`/users/${userId}`);
    const identity = identityResp.data;

    let stats: { avatarUrl: string | null; listeningHours: number; uniqueTracksPlayed: number; topArtists: { artistId: string; name: string }[]; followers: number; following: number } | null = null;
    try {
        const statsResp = await api.get(`/user-profile/${userId}/stats`, {
            params: identity.avatarKey ? { avatarKey: identity.avatarKey } : undefined,
        });
        stats = statsResp.data;
    } catch { }

    return {
        id: identity.id,
        displayName: identity.displayName,
        bio: identity.bio,
        avatarUrl: stats?.avatarUrl ?? null,
        favoriteGenres: identity.favoriteGenres ?? [],
        listeningHours: stats?.listeningHours ?? 0,
        uniqueTracksPlayed: stats?.uniqueTracksPlayed ?? 0,
        topArtists: stats?.topArtists ?? [],
        followers: stats?.followers ?? 0,
        following: stats?.following ?? 0,
    };
}

export async function uploadUserAvatar(file: File): Promise<{ avatarUrl: string }> {
    const fd = new FormData();
    fd.append('file', file);
    const r = await api.post<{ avatarUrl: string }>('/user-profile/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return r.data;
}

export async function deleteUserAvatar(): Promise<void> {
    await api.delete('/user-profile/avatar');
}