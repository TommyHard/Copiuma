namespace Music.API.Models;

/// <summary>
/// Полиморфная подписка. Одна и та же таблица хранит подписки на артистов,
/// пользователей и плейлисты. Composite PK (FollowerUserId, TargetType, TargetId)
/// — один юзер не может подписаться на один и тот же объект дважды
/// </summary>
public class Follow
{
    public Guid FollowerUserId { get; set; }

    public FollowTargetType TargetType { get; set; }
    public Guid TargetId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public enum FollowTargetType
{
    Artist = 0,
    User = 1,
    Playlist = 2
}