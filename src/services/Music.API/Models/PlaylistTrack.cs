namespace Music.API.Models;

public class PlaylistTrack
{
    public Guid PlaylistId { get; set; }
    public Playlist? Playlist { get; set; }

    public Guid TrackId { get; set; }
    public Track? Track { get; set; }

    public DateTime AddedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Порядковая позиция трека в плейлисте
    /// При добавлении трека max(Position) + 1
    /// PATCH /playlists/{id}/tracks/order перезаписывает позиции у всех треков
    /// </summary>
    public int Position { get; set; }
}