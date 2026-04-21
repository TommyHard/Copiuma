namespace Music.API.Models;

public class LikedTrack
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid TrackId { get; set; }

    public DateTime LikedAt { get; set; } = DateTime.UtcNow;

    public Track? Track { get; set; }
}