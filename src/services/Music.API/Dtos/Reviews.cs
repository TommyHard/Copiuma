namespace Music.API.Dtos;

// ---- Ratings ----

public record RateTrackRequest(int Value);

public record TrackRatingResponse(Guid TrackId, int? YourValue, double Average, int Count, int[] Distribution);

// ---- Reviews ----

public record CreateReviewRequest(string Text);

public record UpdateReviewRequest(string Text);

public record ReviewResponse(
    Guid Id,
    Guid TrackId,
    Guid AuthorId,
    string? AuthorName,
    string Text,
    int LikeCount,
    bool LikedByMe,
    DateTime CreatedAt,
    DateTime? UpdatedAt);