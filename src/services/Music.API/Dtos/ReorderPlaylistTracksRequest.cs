namespace Music.API.Dtos;

/// <summary>
/// PATCH /playlists/{id}/tracks/order
/// TrackIds — полный упорядоченный список всех TrackId плейлиста
/// </summary>
public class ReorderPlaylistTracksRequest
{
    public required List<Guid> TrackIds { get; set; }
}