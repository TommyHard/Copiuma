namespace Music.API.Models;

public class TrackReview
{
    public Guid Id { get; set; }

    public Guid TrackId { get; set; }
    public Track? Track { get; set; }

    public Guid AuthorId { get; set; }

    public required string Text { get; set; }

    public bool IsDeleted { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}