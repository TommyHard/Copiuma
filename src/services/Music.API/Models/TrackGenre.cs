namespace Music.API.Models;

public class TrackGenre
{
    public Guid TrackId { get; set; }
    public Track? Track { get; set; }

    public Guid GenreId { get; set; }
    public Genre? Genre { get; set; }
}