namespace Music.API.Models;

public class Playlist
{
    public Guid Id { get; set; }

    public required string Title { get; set; }

    // ID автора
    public Guid UserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public List<PlaylistTrack> PlaylistTracks { get; set; } = new();
}