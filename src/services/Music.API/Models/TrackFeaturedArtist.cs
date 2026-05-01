namespace Music.API.Models;

/// <summary>
/// Доп. исполнители трека
/// </summary>
public class TrackFeaturedArtist
{
    public Guid TrackId { get; set; }
    public Track? Track { get; set; }

    public Guid ArtistId { get; set; }
    public Artist? Artist { get; set; }

    public int Position { get; set; }
}