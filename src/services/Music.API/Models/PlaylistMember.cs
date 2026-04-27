namespace Music.API.Models;

public class PlaylistMember
{
    public Guid PlaylistId { get; set; }
    public Playlist? Playlist { get; set; }

    public Guid UserId { get; set; }
    public string? DisplayName { get; set; }

    public PlaylistRole Role { get; set; }
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}