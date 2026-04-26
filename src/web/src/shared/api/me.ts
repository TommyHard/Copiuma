import { identity } from './http';
import type { MeResponse } from '@/shared/types';

export async function getMe(): Promise<MeResponse> {
    const r = await identity.get<MeResponse>('/me');
    return r.data;
}

export async function becomeArtist(stageName?: string): Promise<{ message: string; role: string }> {
    const r = await identity.post<{ message: string; role: string }>('/me/become-artist', {
        stageName,
    });
    return r.data;
}