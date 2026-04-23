namespace Music.API.Models;

public class ReviewLike
{
    public Guid ReviewId { get; set; }
    public TrackReview? Review { get; set; }

    public Guid UserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}