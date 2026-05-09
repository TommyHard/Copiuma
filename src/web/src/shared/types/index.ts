export type UserRole = 'User' | 'Artist' | 'Moderator' | 'Admin' | 0 | 1 | 2 | 3;

export interface MeResponse {
    id: string;
    email: string;
    displayName: string | null;
    role: UserRole;
    emailVerified: boolean;
    createdAt: string;
    avatarUrl?: string | null;
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
    isLikedByMe?: boolean;
    isDislikedByMe?: boolean;
    featuredArtists?: FeaturedArtist[];
    coverUrl?: string | null;
}

export interface TrackDetail {
    id: string;
    title: string;
    artist: string | null;
    duration: string | null;
    artistId: string | null;
    albumId: string | null;
    albumTitle?: string | null;
    trackNumber: number | null;
    isExplicit: boolean;
    processingStatus: TrackProcessingStatus;
    uploadedByUserId?: string;
    isLikedByMe?: boolean;
    featuredArtists?: FeaturedArtist[];
    genres?: string[];
    coverUrl?: string | null;
    ownCoverUrl?: string | null;
    hasOwnCover?: boolean;
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
    artistId?: string | null;
    likedAt: string;
    coverUrl?: string | null;
    duration?: string | null;
    albumId?: string | null;
    albumTitle?: string | null;
    featuredArtists?: { id: string; name: string }[];
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
    bannerUrl?: string | null;
    followers?: number;
    monthlyListeners?: number;
    ownerUserId?: string;
    createdByUserId?: string;
    albumCount?: number;
    trackCount?: number;
    isBlockedByMe?: boolean;
}

export interface FeaturedArtist {
    id: string;
    name: string;
}

export interface AlbumSummary {
    id: string;
    title: string;
    artistId: string;
    artistName?: string | null;
    artistAvatarUrl?: string | null;
    releasedAt?: string | null;       // YYYY-MM-DD (releaseDate)
    coverUrl?: string | null;
    trackCount?: number;
    ownerUserId?: string;
    createdAt?: string | null;
    genres?: string[];
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
    artistId: string;
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
    isLikedByMe?: boolean;
    coverUrl?: string | null;
    featuredArtists?: FeaturedArtist[];
}

export interface FriendFeedItem {
    userId: string;
    lastPlayedAt: string;
    track: TrackListItem;
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
    previewCovers?: string[];
}

export interface PlaylistMember {
    userId: string;
    displayName?: string | null;
    avatarUrl?: string | null;
    role: string;
    joinedAt: string;
}

export interface PlaylistTrack {
    trackId: string;
    title: string;
    artist: string | null;
    artistId: string | null;
    duration: string | null;
    isExplicit: boolean;
    position: number;
    addedAt: string;
    addedByUserId?: string;
    isLikedByMe?: boolean;
    coverUrl?: string | null;
    albumId?: string | null;
    albumTitle?: string | null;
    featuredArtists?: FeaturedArtist[];
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

export interface RoomParticipant {
    userId: string;
    userName: string;
    isDj: boolean;
}

// Reviews / Ratings

export interface ReviewItem {
    id: string;
    trackId: string;
    authorId: string;
    authorName?: string | null;
    text: string;
    likeCount: number;
    likedByMe: boolean;
    createdAt: string;
    updatedAt?: string | null;
}

export interface TrackRatingResponse {
    trackId: string;
    yourValue: number | null;
    average: number;
    count: number;
    distribution: number[];
}

// Reports

export type ReportTargetType = 'Track' | 'Review' | 'User';
export type ReportStatus = 'Open' | 'Actioned' | 'Dismissed';

export interface ReportItem {
    id: string;
    reporterUserId: string;
    targetType: ReportTargetType;
    targetId: string;
    reason: string;
    details: string | null;
    status: ReportStatus;
    createdAt: string;
    resolvedAt: string | null;
    resolutionNote: string | null;
}

// History

export interface HistoryTrackEntry {
    trackId: string;
    title: string;
    artist: string | null;
    artistId: string | null;
    lastPlayedAt: string;
    playCount: number;
    totalPlayedMs: number;
    coverUrl?: string | null;
}

export interface HistoryArtistEntry {
    artistId: string;
    name: string;
    lastPlayedAt: string;
    playCount: number;
}

// Raw play events
export interface RawPlayEvent {
    trackId: string;
    startedAt: string;
    playedMs: number;
    completed: boolean;
    source: string | null;
    title: string;
    artist: string | null;
    duration: string | null;
}

// User search

export interface UserSearchResult {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
}

// Friends / User follows

export interface FollowedUser {
    userId: string;
    isMutual: boolean;
    subscribedAt: string;
}

export interface FriendItem {
    userId: string;
    sinceAt: string;
}

// Profile / Settings

export interface UserProfile {
    id: string;
    email: string;
    displayName: string | null;
    bio: string | null;
    avatarKey: string | null;
    favoriteGenres: string[];
    language: string;
}

export interface PublicUserProfile {
    id: string;
    displayName: string;
    bio: string | null;
    avatarUrl: string | null;
    favoriteGenres: string[];
    listeningHours: number;
    uniqueTracksPlayed: number;
    topArtists: { artistId: string; name: string; avatarUrl?: string | null }[];
    followers: number;
    following: number;
}