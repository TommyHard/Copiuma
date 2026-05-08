namespace Music.API.Dtos;

public record HistoryFeaturedArtist(Guid Id, string Name);

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
    int PlayCount,
    string? CoverUrl = null,
    IReadOnlyList<HistoryFeaturedArtist>? FeaturedArtists = null,
    bool IsLikedByMe = false);