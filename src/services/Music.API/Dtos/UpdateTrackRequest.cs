namespace Music.API.Dtos;

public class UpdateTrackRequest
{
    /// <summary>
    /// Новое название трека
    /// </summary>
    public required string Title { get; set; }

    /// <summary>
    /// Список жанров в произвольном регистре lower-case
    /// Пустой список или null — жанры очищаются
    /// </summary>
    public List<string>? Genres { get; set; }

    /// <summary>
    /// Explicit-контент
    /// </summary>
    public bool IsExplicit { get; set; }

    /// <summary>
    /// ID доп. исполнителей
    /// </summary>
    public List<Guid>? FeaturedArtistIds { get; set; }
}