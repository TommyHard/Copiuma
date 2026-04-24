namespace Music.API.Dtos;

public record ReportPlayRequest(int PlayedMs, bool Completed, string? Source);

public record TrackRecommendationItem(
    Guid TrackId,
    string Title,
    string? Artist,
    Guid? ArtistId,
    Guid? AlbumId,
    int Score);

public record ArtistRecommendationItem(
    Guid ArtistId,
    string Name,
    int PlayCount);