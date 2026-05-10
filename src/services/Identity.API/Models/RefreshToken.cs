namespace Identity.API.Models;

public class RefreshToken
{
    public Guid Id { get; set; }
    /// <summary>
    /// SHA-256 хэш refresh-токена. Сам токен НЕ храним — только хэш,
    /// чтобы дамп БД не выдал валидные refresh-токены
    /// </summary>
    public required string TokenHash { get; set; }
    public DateTime ExpiryDate { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Когда был отзыв
    /// </summary>
    public DateTime? RevokedAt { get; set; }
    /// <summary>
    /// Причина отзыва: 'rotated' / 'logout' / 'reuse-detected' / 'password-reset'
    /// </summary>
    public string? RevokedReason { get; set; }
    /// <summary>
    /// При rotate сохраняем id новой сессии
    /// </summary>
    public Guid? ReplacedBySessionId { get; set; }

    /// <summary>
    /// IP в момент выдачи (login) или последнего rotate
    /// </summary>
    public string? IpAddress { get; set; }

    /// <summary>
    /// User-Agent в момент выдачи или последнего rotate
    /// </summary>
    public string? UserAgent { get; set; }

    /// <summary>
    /// Опциональная подпись клиента: "Chrome on Windows", "Copiuma Desktop 1.0"
    /// </summary>
    public string? DeviceLabel { get; set; }

    /// <summary>
    /// Когда последний раз использовался для rotate (или null, если ещё ни разу)
    /// </summary>
    public DateTime? LastUsedAt { get; set; }

    public Guid UserId { get; set; }
    public User? User { get; set; }
}