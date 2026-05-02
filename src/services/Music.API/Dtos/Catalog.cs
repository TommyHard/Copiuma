namespace Music.API.Dtos;

// Artists

public record CreateArtistRequest(string Name, string? Bio);
public record UpdateArtistRequest(string? Name, string? Bio);

public record ArtistResponse(
    Guid Id,
    string Name,
    string? Bio,
    string? AvatarUrl,
    string? BannerUrl,
    Guid CreatedByUserId,
    DateTime CreatedAt,
    int AlbumCount,
    int TrackCount,
    int Followers = 0,
    int MonthlyListeners = 0);

public record ArtistListItem(
    Guid Id,
    string Name,
    string? AvatarUrl,
    int AlbumCount,
    int TrackCount);

// Albums

public record CreateAlbumRequest(Guid ArtistId, string Title, DateOnly? ReleaseDate, List<string>? Genres = null);
public record UpdateAlbumRequest(string? Title, DateOnly? ReleaseDate, List<string>? Genres = null);

public record AlbumResponse(
    Guid Id,
    string Title,
    Guid ArtistId,
    string ArtistName,
    string? CoverUrl,
    DateOnly? ReleaseDate,
    IReadOnlyList<string> Genres,
    Guid CreatedByUserId,
    DateTime CreatedAt,
    int TrackCount);

public record AlbumListItem(
    Guid Id,
    string Title,
    Guid ArtistId,
    string ArtistName,
    string? CoverUrl,
    DateOnly? ReleaseDate,
    IReadOnlyList<string> Genres,
    int TrackCount);

public record AlbumTrackItem(
    Guid Id,
    string Title,
    int? TrackNumber,
    TimeSpan? Duration,
    string? CoverUrl = null,
    string? Artist = null,
    Guid? ArtistId = null,
    bool IsExplicit = false);

public record AttachAlbumTrackRequest(int? TrackNumber);