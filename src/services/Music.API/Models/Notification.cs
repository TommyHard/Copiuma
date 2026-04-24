namespace Music.API.Models;

public class Notification
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }

    public required string Type { get; set; }

    public required string Payload { get; set; }

    public bool IsRead { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class NotificationTypes
{
    public const string PlaylistInvitation = "playlist.invitation";
    public const string PlaylistInvitationAccepted = "playlist.invitation.accepted";
    public const string PlaylistInvitationDeclined = "playlist.invitation.declined";
    public const string TrackProcessed = "track.processed";

    public const string TrackReviewCreated = "track.review.created";
    public const string ReviewLiked = "review.liked";

    public const string ArtistReleasedTrack = "artist.released.track";
    public const string ArtistReleasedAlbum = "artist.released.album";

    public const string UserFollowedYou = "user.followed.you";
    public const string BecameFriends = "user.became.friends";
}