using NpgsqlTypes;

namespace Music.API.Models;

public class Album
{
    public Guid Id { get; set; }

    public required string Title { get; set; }

    public Guid ArtistId { get; set; }
    public Artist? Artist { get; set; }

    public string? CoverKey { get; set; }

    public DateOnly? ReleaseDate { get; set; }

    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public NpgsqlTsVector? SearchVector { get; set; }
}