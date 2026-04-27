import { api } from './http';
import type {
    PlaylistDetail,
    PlaylistSummary,
    PlaylistVisibility,
} from '@/shared/types';

/**
 * Endpoints:
 *   POST   /playlists                                    Ч создать
 *   DELETE /playlists/{id}                               Ч удалить
 *   GET    /playlists                                    Ч мои + те, где € член
 *   GET    /playlists/{id}                               Ч детали + tracks + members
 *   GET    /playlists/public                             Ч публичные (discover)
 *   PATCH  /playlists/{id}/visibility                    Ч Private/Unlisted/Public
 *   POST   /playlists/{id}/tracks/{trackId}              Ч добавить трек
 *   DELETE /playlists/{id}/tracks/{trackId}              Ч удалить трек
 *   POST   /playlists/{id}/invite                        Ч пригласить участника
 *   GET    /playlists/{id}/invitations                   Ч список pending-приглашений (от owner)
 *   DELETE /playlists/{id}/invitations/{invitationId}    Ч отозвать приглашение
 *   DELETE /playlists/{id}/members/{userId}              Ч выгнать
 *   POST   /playlists/{id}/leave                         Ч самому выйти
 */

export interface CreatePlaylistRequest {
    title: string;
    visibility?: PlaylistVisibility;
    isCollaborative?: boolean;
}

export async function listPlaylists(): Promise<PlaylistSummary[]> {
    const r = await api.get<PlaylistSummary[]>('/playlists');
    return r.data;
}

export async function listPublicPlaylists(): Promise<PlaylistSummary[]> {
    const r = await api.get<PlaylistSummary[]>('/playlists/public');
    return r.data;
}

export async function getPlaylist(id: string): Promise<PlaylistDetail> {
    const r = await api.get<PlaylistDetail>(`/playlists/${id}`);
    return r.data;
}

export async function createPlaylist(req: CreatePlaylistRequest): Promise<PlaylistSummary> {
    const r = await api.post<PlaylistSummary>('/playlists', {
        title: req.title,
        visibility: req.visibility ?? 'Private',
        isCollaborative: req.isCollaborative ?? false,
    });
    return r.data;
}

export async function deletePlaylist(id: string): Promise<void> {
    await api.delete(`/playlists/${id}`);
}

export async function setVisibility(id: string, visibility: PlaylistVisibility): Promise<void> {
    await api.patch(`/playlists/${id}/visibility`, { visibility });
}

export async function addTrack(playlistId: string, trackId: string): Promise<void> {
    await api.post(`/playlists/${playlistId}/tracks/${trackId}`);
}

export async function removeTrack(playlistId: string, trackId: string): Promise<void> {
    await api.delete(`/playlists/${playlistId}/tracks/${trackId}`);
}

export async function invite(
    playlistId: string,
    inviteeId: string,
    role: string = 'Member',
): Promise<void> {
    await api.post(`/playlists/${playlistId}/invite`, { inviteeId, role });
}

export async function listInvitationsForPlaylist(playlistId: string) {
    const r = await api.get(`/playlists/${playlistId}/invitations`);
    return r.data;
}

export async function revokeInvitation(playlistId: string, invitationId: string): Promise<void> {
    await api.delete(`/playlists/${playlistId}/invitations/${invitationId}`);
}

export async function removeMember(playlistId: string, userId: string): Promise<void> {
    await api.delete(`/playlists/${playlistId}/members/${userId}`);
}

export async function leavePlaylist(playlistId: string): Promise<void> {
    await api.post(`/playlists/${playlistId}/leave`);
}