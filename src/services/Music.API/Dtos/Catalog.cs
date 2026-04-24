namespace Music.API.Dtos;

// ---- Artists ----

public record CreateArtistRequest(string Name, string? Bio);
public record UpdateArtistRequest(string? Name, string? Bio);

public record ArtistResponse(
    Guid Id,
    string Name,
    string? Bio,
    string? AvatarUrl,
    Guid CreatedByUserId,
    DateTime CreatedAt,
    int AlbumCount,
    int TrackCount);

public record ArtistListItem(
    Guid Id,
    string Name,
    string? AvatarUrl,
    int AlbumCount,
    int TrackCount);

// ---- Albums ----

public record CreateAlbumRequest(Guid ArtistId, string Title, DateOnly? ReleaseDate, string? Genre = null);
public record UpdateAlbumRequest(string? Title, DateOnly? ReleaseDate, string? Genre = null);

public record AlbumResponse(
    Guid Id,
    string Title,
    Guid ArtistId,
    string ArtistName,
    string? CoverUrl,
    DateOnly? ReleaseDate,
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
    int TrackCount);

public record AlbumTrackItem(
    Guid Id,
    string Title,
    int? TrackNumber,
    TimeSpan? Duration);

public record AttachAlbumTrackRequest(int? TrackNumber);