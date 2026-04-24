using NpgsqlTypes;

namespace Music.API.Models;

public class Track
{
    public Guid Id { get; set; }

    public required string Title { get; set; }

    public string? Artist { get; set; }

    public required string FileName { get; set; }

    public required string ContentType { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    public Guid UploadedByUserId { get; set; }

    public TimeSpan? Duration { get; set; }

    public Guid? ArtistId { get; set; }
    public Artist? ArtistEntity { get; set; }

    public Guid? AlbumId { get; set; }
    public Album? Album { get; set; }

    public int? TrackNumber { get; set; }

    public string? Genre { get; set; }

    public NpgsqlTsVector? SearchVector { get; set; }
}