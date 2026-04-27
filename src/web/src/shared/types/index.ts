export type UserRole = 'User' | 'Artist' | 'Moderator' | 'Admin' | 0 | 1 | 2 | 3;

export interface MeResponse {
    id: string;
    email: string;
    displayName: string | null;
    role: UserRole;
    emailVerified: boolean;
    createdAt: string;
}

export interface LoginResponse {
    token: string;
    refreshToken: string;
}

export interface SessionResponse {
    id: string;
    deviceLabel: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    lastUsedAt: string | null;
    expiryDate: string;
    isCurrent: boolean;
}

// Tracks

export type TrackProcessingStatus = 'Pending' | 'Processing' | 'Ready' | 'Failed';
export type TrackHlsStatus = 'NotRequested' | 'Pending' | 'Processing' | 'Ready' | 'Failed';

export interface TrackListItem {
    id: string;
    title: string;
    artist: string | null;
    duration: string | null;
    uploadedAt: string;
    artistId: string | null;
    albumId: string | null;
    trackNumber: number | null;
    isExplicit: boolean;
}

export interface TrackDetail {
    id: string;
    title: string;
    artist: string | null;
    duration: string | null;
    artistId: string | null;
    albumId: string | null;
    trackNumber: number | null;
    isExplicit: boolean;
    processingStatus: TrackProcessingStatus;
    uploadedByUserId?: string;
}

export interface TrackProcessingStatusResponse {
    trackId: string;
    status: TrackProcessingStatus;
    hasWaveform: boolean;
    duration: string | null;
}

export interface WaveformResponse {
    trackId: string;
    peaks: number[];
    duration: string;
    loudnessLufs: number;
}

export interface FavoriteItem {
    id: string;
    title: string;
    artist: string | null;
    likedAt: string;
}

export interface UploadResult {
    message: string;
    trackId: string;
    fileName: string;
}

// Catalog: artists / albums

export interface ArtistSummary {
    id: string;
    name: string;
    bio?: string | null;
    avatarUrl?: string | null;
    followers?: number;
}

export interface AlbumSummary {
    id: string;
    title: string;
    artistId: string;
    artistName?: string | null;
    releasedAt?: string | null;
    coverUrl?: string | null;
    trackCount?: number;
}

// Notifications

export type NotificationType =
    | 'TrackProcessed'
    | 'NewTrackByFollowed'
    | 'NewFollower'
    | 'PlaylistInvitation'
    | 'ReviewReceived'
    | string;

export interface NotificationItem {
    id: string;
    type: NotificationType;
    title: string;
    message: string | null;
    payload?: Record<string, unknown> | null;
    isRead: boolean;
    createdAt: string;
}

// Follows

export interface FollowedArtist {
    id: string;
    name: string;
    followedAt: string;
}

export interface FeedItem {
    trackId: string;
    title: string;
    artist: string | null;
    artistId: string | null;
    uploadedAt: string;
    duration: string | null;
}

// Playlists

export type PlaylistVisibility = 'Private' | 'Unlisted' | 'Public';

export interface PlaylistSummary {
    id: string;
    title: string;
    ownerId: string;
    ownerName?: string | null;
    visibility: PlaylistVisibility;
    isCollaborative: boolean;
    trackCount: number;
    coverUrl?: string | null;
    updatedAt: string;
}

export interface PlaylistMember {
    userId: string;
    displayName?: string | null;
    role: string;            // "Owner" | "Member" | "Editor"
    joinedAt: string;
}

export interface PlaylistTrack {
    trackId: string;
    title: string;
    artist: string | null;
    duration: string | null;
    isExplicit: boolean;
    position: number;
    addedAt: string;
    addedByUserId?: string;
}

export interface PlaylistDetail extends PlaylistSummary {
    tracks: PlaylistTrack[];
    members: PlaylistMember[];
}

export interface PlaylistInvitation {
    id: string;
    playlistId: string;
    playlistTitle: string;
    inviterId: string;
    inviterName: string | null;
    proposedRole: string;
    status: 'Pending' | 'Accepted' | 'Declined' | string;
    createdAt: string;
}

// DJ rooms

/** —етева€ "карточка участника" комнаты Ч обновл€етс€ по ParticipantJoined/Left */
export interface RoomParticipant {
    userId: string;
    userName: string;
    isDj: boolean;
}