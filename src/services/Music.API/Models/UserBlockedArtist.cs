namespace Music.API.Models;

/// <summary>
/// Жесткая блокировка артиста пользователем
/// Исключает треки, альбомы и самого артиста из всех выдач
/// </summary>
public class UserBlockedArtist
{
    public Guid UserId { get; set; }
    public Guid ArtistId { get; set; }
    public Artist? Artist { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}