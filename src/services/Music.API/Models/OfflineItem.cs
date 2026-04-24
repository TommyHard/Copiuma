namespace Music.API.Models;

/// <summary>
/// Трек, помеченный пользователем «для офлайна». Хранится как закладка
/// на (UserId, TrackId) - сам файл лежит в MinIO, клиент его качает по URL
/// </summary>
public class OfflineItem
{
    public Guid UserId { get; set; }
    public Guid TrackId { get; set; }
    public Track? Track { get; set; }

    /// <summary>"single" | "playlist:{guid}" | "album:{guid}"</summary>
    public string Source { get; set; } = "single";

    public DateTime AddedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Последний раз, когда клиент отчитался о скачивании через /downloaded
    /// </summary>
    public DateTime? LastDownloadedAt { get; set; }
}