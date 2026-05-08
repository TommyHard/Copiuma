import { api } from './http';
import type {
    PlaylistDetail,
    PlaylistSummary,
    PlaylistVisibility,
} from '@/shared/types';

/**
 * Endpoints:
 *   POST   /playlists                                    — создать
 *   DELETE /playlists/{id}                               — удалить
 *   GET    /playlists                                    — мои + те, где я член
 *   GET    /playlists/{id}                               — детали + tracks + members
 *   GET    /playlists/public                             — публичные (discover)
 *   PATCH  /playlists/{id}/visibility                    — Private/Unlisted/Public
 *   POST   /playlists/{id}/tracks/{trackId}              — добавить трек
 *   DELETE /playlists/{id}/tracks/{trackId}              — удалить трек
 *   POST   /playlists/{id}/invite                        — пригласить участника
 *   GET    /playlists/{id}/invitations                   — список pending-приглашений (от owner)
 *   DELETE /playlists/{id}/invitations/{invitationId}    — отозвать приглашение
 *   DELETE /playlists/{id}/members/{userId}              — выгнать
 *   POST   /playlists/{id}/leave                         — самому выйти
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

export async function renamePlaylist(id: string, title: string): Promise<void> {
    await api.put(`/playlists/${id}`, { title });
}

export async function addTrack(playlistId: string, trackId: string): Promise<void> {
    await api.post(`/playlists/${playlistId}/tracks/${trackId}`);
}

export async function removeTrack(playlistId: string, trackId: string): Promise<void> {
    await api.delete(`/playlists/${playlistId}/tracks/${trackId}`);
}

/**
 * Возвращает ID плейлистов, в которых уже лежит данный трек
 * Используется для отметки в меню "Добавить в плейлист"
 */
export async function getPlaylistsContainingTrack(trackId: string): Promise<string[]> {
    const r = await api.get<string[]>(`/playlists/containing/${trackId}`);
    return Array.isArray(r.data) ? r.data : [];
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

export async function reorderTracks(playlistId: string, trackIds: string[]): Promise<void> {
    await api.patch(`/playlists/${playlistId}/tracks/order`, { trackIds });
}

export interface PlaylistAudit {
    id: string;
    entityType: string;
    changeKind: number; // 0: Created, 1: Updated, 2: Deleted
    actorUserId: string | null;
    changes: string;
    createdAt: string;
    trackTitle: string | null;
}

export async function getPlaylistAudit(
    playlistId: string,
    skip: number = 0,
    take: number = 8
): Promise<PlaylistAudit[]> {
    const r = await api.get<PlaylistAudit[]>(`/playlists/${playlistId}/audit?skip=${skip}&take=${take}`);
    return r.data;
}