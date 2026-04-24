using NpgsqlTypes;

namespace Music.API.Models;

/// <summary>
/// Альбом: принадлежит одному Artist, содержит несколько Track
/// Обложка хранится в bucket "images"
/// </summary>
public class Album
{
    public Guid Id { get; set; }

    public required string Title { get; set; }

    public Guid ArtistId { get; set; }
    public Artist? Artist { get; set; }

    public string? CoverKey { get; set; }

    public DateOnly? ReleaseDate { get; set; }

    /// <summary>
    /// Массив жанров в lower-case ("rock", "post-punk")
    /// Пустой массив = жанр не указан
    /// </summary>
    public List<string> Genres { get; set; } = new();

    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public NpgsqlTsVector? SearchVector { get; set; }
}