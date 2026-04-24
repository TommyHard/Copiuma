namespace Music.API.Models;

/// <summary>
/// Подписка пользователя на артиста
/// Составной PK (FollowerUserId, ArtistId) — один юзер не может подписаться
/// на одного артиста дважды. Отписка = удаление строки
/// </summary>
public class Follow
{
    public Guid FollowerUserId { get; set; }

    public Guid ArtistId { get; set; }
    public Artist? Artist { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}