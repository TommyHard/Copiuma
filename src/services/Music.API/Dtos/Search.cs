namespace Music.API.Dtos;

/// <summary>
/// Унифицированный ответ поиска. Треки/артисты/альбомы идут отдельными
/// списками
/// </summary>
public record SearchResult(
    IReadOnlyList<SearchTrackItem> Tracks,
    IReadOnlyList<SearchArtistItem> Artists,
    IReadOnlyList<SearchAlbumItem> Albums,
    IReadOnlyList<SearchPlaylistItem> Playlists);

public record SearchTrackItem(
    Guid Id,
    string Title,
    string? Artist,
    Guid? ArtistId,
    Guid? AlbumId,
    TimeSpan? Duration,
    IReadOnlyList<string> Genres,
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
    IReadOnlyList<string> Genres,
    float Rank);

public record SearchPlaylistItem(
    Guid Id,
    string Title,
    DateTime CreatedAt,
    int TrackCount);

/// <summary>
/// Флаги, чтобы клиент мог сделать "только артисты" или всё сразу
/// </summary>
[Flags]
public enum SearchTypes
{
    None = 0,
    Tracks = 1 << 0,
    Artists = 1 << 1,
    Albums = 1 << 2,
    Playlists = 1 << 3,
    All = Tracks | Artists | Albums | Playlists
}

/// <summary>
/// Genres — массив жанров (OR-пересечение с Track.Genres/Album.Genres).
/// Пустой список = фильтр не применяется
/// </summary>
public record SearchFacets(
    List<string>? Genres = null,
    int? YearFrom = null,
    int? YearTo = null,
    int? MinDurationMs = null,
    int? MaxDurationMs = null);