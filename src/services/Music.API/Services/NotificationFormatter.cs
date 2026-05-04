using System.Text.Json;
using Music.API.Models;

namespace Music.API.Services;

public static class NotificationFormatter
{
    public static (string Title, string? Message) Format(string type, JsonElement payload)
    {
        switch (type)
        {
            case NotificationTypes.ReviewLiked:
                {
                    var likerName = GetString(payload, "likerName") ?? "Кто-то";
                    var trackTitle = GetString(payload, "trackTitle");
                    var msg = trackTitle is null
                        ? $"{likerName} оценил ваш отзыв."
                        : $"{likerName} оценил ваш отзыв на «{trackTitle}».";
                    return ("Новый лайк", msg);
                }

            case NotificationTypes.TrackReviewCreated:
                {
                    var authorName = GetString(payload, "authorName") ?? "Пользователь";
                    var trackTitle = GetString(payload, "trackTitle") ?? "ваш трек";
                    var excerpt = GetString(payload, "excerpt");
                    var msg = string.IsNullOrWhiteSpace(excerpt)
                        ? $"{authorName} оставил отзыв на «{trackTitle}»."
                        : $"{authorName} оставил отзыв на «{trackTitle}»: {excerpt}";
                    return ("Новый отзыв", msg);
                }

            case NotificationTypes.TrackProcessed:
                {
                    var trackName = GetString(payload, "title")
                        ?? GetString(payload, "trackTitle")
                        ?? "Трек";
                    return ("Трек обработан", $"«{trackName}» готов к прослушиванию.");
                }

            case NotificationTypes.PlaylistInvitation:
                {
                    var inviter = GetString(payload, "inviterName") ?? "Кто-то";
                    var playlist = GetString(payload, "playlistTitle") ?? "плейлист";
                    var role = GetString(payload, "proposedRole");
                    var roleLabel = FormatRole(role);
                    var msg = roleLabel is null
                        ? $"{inviter} приглашает вас в плейлист «{playlist}»."
                        : $"{inviter} приглашает вас в плейлист «{playlist}» как {roleLabel}.";
                    return ("Приглашение в плейлист", msg);
                }

            case NotificationTypes.PlaylistInvitationAccepted:
                {
                    var invitee = GetString(payload, "inviteeName") ?? "Пользователь";
                    var playlist = GetString(payload, "playlistTitle") ?? "ваш плейлист";
                    return ("Приглашение принято", $"{invitee} присоединился к плейлисту «{playlist}».");
                }

            case NotificationTypes.PlaylistInvitationDeclined:
                {
                    var invitee = GetString(payload, "inviteeName") ?? "Пользователь";
                    var playlist = GetString(payload, "playlistTitle") ?? "ваш плейлист";
                    return ("Приглашение отклонено", $"{invitee} отклонил приглашение в плейлист «{playlist}».");
                }

            case NotificationTypes.ArtistReleasedTrack:
                {
                    var artist = GetString(payload, "artistName") ?? "Артист";
                    var track = GetString(payload, "trackTitle") ?? "новый трек";
                    return ("Новый релиз", $"{artist} выпустил трек «{track}».");
                }

            case NotificationTypes.ArtistReleasedAlbum:
                {
                    var artist = GetString(payload, "artistName") ?? "Артист";
                    var album = GetString(payload, "albumTitle") ?? "новый альбом";
                    return ("Новый альбом", $"{artist} выпустил альбом «{album}».");
                }

            case NotificationTypes.UserFollowedYou:
                {
                    var follower = GetString(payload, "followerName") ?? "Кто-то";
                    return ("Новый подписчик", $"{follower} подписался на вас.");
                }

            case NotificationTypes.BecameFriends:
                {
                    var name = GetString(payload, "userName");
                    var msg = name is null
                        ? "Теперь вы взаимно подписаны."
                        : $"Вы и {name} теперь взаимно подписаны.";
                    return ("У вас новый друг", msg);
                }

            default:
                return ("Новое уведомление", null);
        }
    }

    private static string? GetString(JsonElement payload, string property)
    {
        if (payload.ValueKind != JsonValueKind.Object) return null;
        if (!payload.TryGetProperty(property, out var v)) return null;
        if (v.ValueKind == JsonValueKind.Null || v.ValueKind == JsonValueKind.Undefined) return null;
        return v.ValueKind == JsonValueKind.String ? v.GetString() : v.ToString();
    }

    private static string? FormatRole(string? role) => role switch
    {
        null => null,
        "Owner" => "владельца",
        "Editor" => "редактора",
        "Viewer" => "слушателя",
        _ => role
    };
}