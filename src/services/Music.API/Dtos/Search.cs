namespace Music.API.Dtos;

/// <summary>
/// Унифицированный ответ поиска. Треки/артисты/альбомы идут отдельными
/// списками
/// </summary>
public record SearchResult(
    IReadOnlyList<SearchTrackItem> Tracks,
    IReadOnlyList<SearchArtistItem> Artists,
    IReadOnlyList<SearchAlbumItem> Albums);

public record SearchTrackItem(
    Guid Id,
    string Title,
    string? Artist,
    Guid? ArtistId,
    Guid? AlbumId,
    TimeSpan? Duration,
    float Rank);

public record SearchArtistItem(
    Guid Id,
    string Name,
    string? AvatarKey,
    float Rank);

public record SearchAlbumItem(
    Guid Id,
    string Title,
    Guid ArtistId,
    string? ArtistName,
    DateOnly? ReleaseDate,
    string? CoverKey,
    float Rank);

/// <summary>
/// Флаги, чтобы клиент мог сделать "только артисты"
/// или всё сразу
/// </summary>
[Flags]
public enum SearchTypes
{
    None = 0,
    Tracks = 1 << 0,
    Artists = 1 << 1,
    Albums = 1 << 2,
    All = Tracks | Artists | Albums
}