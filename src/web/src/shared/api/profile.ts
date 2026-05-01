/**
 * Операции с профилем пользователя
 * /api/profile/* -> Identity.API /profile/*
 */
import { api } from './http';
import type { UserProfile } from '@/shared/types';

export async function getProfile(): Promise<UserProfile> {
    const r = await api.get<UserProfile>('/profile');
    return r.data;
}

export interface UpdateProfilePayload {
    displayName?: string;
    favoriteGenres: string[];
    language: string;
}

export async function updateProfile(payload: UpdateProfilePayload): Promise<void> {
    await api.put('/profile', payload);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await api.post('/profile/change-password', { currentPassword, newPassword });
}