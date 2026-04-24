namespace Music.API.Models;

public enum DislikeTargetType
{
    Track = 0,
    Artist = 1
}

/// <summary>
/// Негативная обратная связь. Используется в RecommendationsService,
/// чтобы в for-you/popular не попадали mute треки и треки mute артистов
/// </summary>
public class UserDislike
{
    public Guid UserId { get; set; }
    public DislikeTargetType TargetType { get; set; }
    public Guid TargetId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}