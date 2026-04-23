namespace Music.API.Models;

public class TrackRating
{
    public Guid UserId { get; set; }
    public Guid TrackId { get; set; }
    public Track? Track { get; set; }

    public int Value { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}