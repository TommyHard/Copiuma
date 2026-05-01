namespace Music.API.Dtos;

public class UploadTrackRequest
{
    public required IFormFile File { get; set; }
    public required string Title { get; set; }

    public string? Artist { get; set; }

    public Guid? ArtistId { get; set; }
    public Guid? AlbumId { get; set; }
    public int? TrackNumber { get; set; }

    public List<string>? Genres { get; set; }

    /// <summary>
    /// ID доп. исполнителей
    /// </summary>
    public List<Guid>? FeaturedArtistIds { get; set; }
}