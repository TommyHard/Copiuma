import { api } from './http';

export interface UserStateResponse {
    state: Record<string, unknown> | null;
    version: number;
    updatedAt: string | null;
}

export async function getUserState(): Promise<UserStateResponse> {
    const r = await api.get<any>('/user-state');
    return {
        state: r.data?.state ?? null,
        version: r.data?.version ?? 0,
        updatedAt: r.data?.updatedAt ?? null,
    };
}

export async function putUserState(
    state: Record<string, unknown>,
    expectedVersion?: number,
): Promise<{ version: number; updatedAt: string }> {
    const r = await api.put('/user-state', { state, expectedVersion });
    return r.data;
}