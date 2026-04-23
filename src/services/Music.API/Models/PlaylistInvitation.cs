namespace Music.API.Models;

public enum InvitationStatus
{
    Pending = 0,
    Accepted = 1,
    Declined = 2,
    Cancelled = 3
}

public class PlaylistInvitation
{
    public Guid Id { get; set; }

    public Guid PlaylistId { get; set; }
    public Playlist? Playlist { get; set; }

    public Guid InviterId { get; set; }
    public Guid InviteeId { get; set; }

    public PlaylistRole ProposedRole { get; set; }

    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RespondedAt { get; set; }
}
