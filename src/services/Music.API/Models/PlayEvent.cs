namespace Music.API.Models;

/// <summary>
/// Запись факта прослушивания трека пользователем. Клиент сам сообщает
/// событие (в конце трека или при переключении).
/// Пишется в рекомендации (popular / similar / for-you) + будущая аналитика.
/// </summary>
public class PlayEvent
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }

    public Guid TrackId { get; set; }
    public Track? Track { get; set; }

    /// <summary>Сколько миллисекунд реально было проиграно клиентом</summary>
    public int PlayedMs { get; set; }

    /// <summary>true, если клиент дослушал до конца (или >= 90%).</summary>
    public bool Completed { get; set; }

    public string? Source { get; set; }

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
}