namespace Music.API.Models;

/// <summary>
/// Жалоба на контент (трек / ревью / user)
/// Хранит "как есть" от юзера + итог модератора
/// </summary>
public class Report
{
    public Guid Id { get; set; }

    public Guid ReporterUserId { get; set; }

    public ReportTargetType TargetType { get; set; }
    public Guid TargetId { get; set; }

    /// <summary>
    /// Короткий код: "spam" / "copyright" / "offensive" / "other"
    /// </summary>
    public required string Reason { get; set; }

    /// <summary>
    /// Произвольное пояснение от user, до 2000 символов
    /// </summary>
    public string? Details { get; set; }

    public ReportStatus Status { get; set; } = ReportStatus.Open;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // ---- После рассмотрения ----
    public Guid? ResolvedByUserId { get; set; }
    public DateTime? ResolvedAt { get; set; }
    public string? ResolutionNote { get; set; }
}

public enum ReportTargetType
{
    Track = 0,
    Review = 1,
    User = 2
}

public enum ReportStatus
{
    Open = 0,
    Actioned = 1,   // модер наложил
    Dismissed = 2   // жалоба отклонена
}

/// <summary>
/// Флаг на юзере — shadowban / muted / verified
/// </summary>
public class UserFlag
{
    public Guid UserId { get; set; }
    public UserFlagKind Kind { get; set; }

    public Guid SetByUserId { get; set; }
    public DateTime SetAt { get; set; } = DateTime.UtcNow;
    public string? Note { get; set; }

    /// <summary>
    /// null = бессрочно
    /// </summary>
    public DateTime? ExpiresAt { get; set; }
}

public enum UserFlagKind
{
    /// <summary>
    /// Контент user не попадает в listing/search/feed, но видим самому user
    /// </summary>
    Shadowbanned = 0,

    /// <summary>
    /// Юзер не может писать ревью/репортить
    /// </summary>
    Muted = 1,

    /// <summary>
    /// Верифицирован
    /// </summary>
    Verified = 2
}