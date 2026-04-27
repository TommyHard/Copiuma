namespace Music.API.Models;

/// <summary>
/// Видимость плейлиста
/// Private — видно только участникам (PlaylistMembers)
/// Public  — виден всем авторизованным, появляется в /playlists/public и /search?types=playlists
/// Unlisted — не появляется в общих списках, но доступен всем, у кого есть прямая ссылка (id)
/// </summary>
public enum PlaylistVisibility
{
    Private = 0,
    Public = 1,
    Unlisted = 2
}
