import { api } from './http';
import type { PlaylistInvitation } from '@/shared/types';

export async function listIncomingInvitations(): Promise<PlaylistInvitation[]> {
  const r = await api.get<PlaylistInvitation[]>('/invitations');
  return r.data;
}

export async function acceptInvitation(id: string): Promise<void> {
  await api.post(`/invitations/${id}/accept`);
}

export async function declineInvitation(id: string): Promise<void> {
  await api.post(`/invitations/${id}/decline`);
}