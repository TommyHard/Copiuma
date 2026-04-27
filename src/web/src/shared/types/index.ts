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

// Tracks (catalog)

export type TrackProcessingStatus = 'Pending' | 'Processing' | 'Ready' | 'Failed';
export type TrackHlsStatus = 'NotRequested' | 'Pending' | 'Processing' | 'Ready' | 'Failed';

export interface TrackListItem {
    id: string;
    title: string;
    artist: string | null;
    duration: string | null; // backend сериализует TimeSpan как "00:03:42"
    uploadedAt: string;
    artistId: string | null;
    albumId: string | null;
    trackNumber: number | null;
    isExplicit: boolean;
}

/** Полная карточка из GET /tracks/{id} */
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
}

export interface TrackProcessingStatusResponse {
    trackId: string;
    status: TrackProcessingStatus;
    hasWaveform: boolean;
    duration: string | null;
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