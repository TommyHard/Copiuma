namespace Music.API.Models;

/// <summary>
/// Видимость плейлиста
/// Private — видно только участникам (PlaylistMembers)
/// Public  — виден всем авторизованным, появляется в /playlists/public и /search?types=playlists
/// </summary>
public enum PlaylistVisibility
{
    Private = 0,
    Public = 1
}
