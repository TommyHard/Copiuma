namespace Music.API.Dtos;

/// <summary>
/// "Недавно прослушанное" для пользователя
/// </summary>
public record HistoryTrackItem(
    Guid TrackId,
    string Title,
    string? Artist,
    Guid? ArtistId,
    Guid? AlbumId,
    TimeSpan? Duration,
    DateTime LastPlayedAt,
    int PlayCount);