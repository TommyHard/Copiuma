namespace Music.API.Dtos;

/// <summary>
/// Артист + счётчики для экрана "мои подписки" и "похожие артисты"
/// </summary>
public record FollowedArtistItem(
    Guid ArtistId,
    string Name,
    string? AvatarKey,
    int FollowersCount,
    DateTime SubscribedAt);

/// <summary>
/// Элемент фида: либо новый трек, либо новый альбом от артиста, на которого подписан user
/// </summary>
public record FeedItem(
    string Kind,
    Guid EntityId,
    string Title,
    Guid ArtistId,
    string ArtistName,
    string? CoverKey,
    DateTime ReleasedAt);

/// <summary>
/// Топ артистов юзера по истории прослушиваний. За окно sinceDays
/// Score = число уникальных прослушиваний треков артиста
/// </summary>
public record TopArtistItem(
    Guid ArtistId,
    string Name,
    string? AvatarKey,
    int PlayCount,
    DateTime LastPlayedAt);

/// <summary>
/// Подписка юзера на другого юзера. IsMutual = true если он тоже подписан в ответ (друг)
/// </summary>
public record FollowedUserItem(
    Guid UserId,
    bool IsMutual,
    DateTime SubscribedAt);

/// <summary>
/// Подписка user на плейлист
/// </summary>
public record FollowedPlaylistItem(
    Guid PlaylistId,
    string Title,
    DateTime SubscribedAt);

/// <summary>
/// Взаимная подписка (друг)
/// </summary>
public record FriendItem(
    Guid UserId,
    DateTime SinceAt);