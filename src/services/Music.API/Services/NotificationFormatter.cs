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
                var likerName = payload.TryGetProperty("likerName", out var ln) && ln.ValueKind != JsonValueKind.Null
                    ? ln.GetString()
                    : "Кто-то";
                return ("Новый лайк!", $"{likerName} оценил ваш отзыв.");

            case NotificationTypes.TrackReviewCreated:
                var authorName = payload.TryGetProperty("authorName", out var an) && an.ValueKind != JsonValueKind.Null
                    ? an.GetString()
                    : "Пользователь";
                var trackTitle = payload.TryGetProperty("trackTitle", out var tt) ? tt.GetString() : "ваш трек";
                return ("Новый отзыв", $"{authorName} оставил отзыв на {trackTitle}.");

            case NotificationTypes.TrackProcessed:
                var trackName = payload.TryGetProperty("title", out var title) ? title.GetString() : "Трек";
                return ("Трек обработан", $"{trackName} готов к прослушиванию.");

            default:
                return ("Новое уведомление", null);
        }
    }
}