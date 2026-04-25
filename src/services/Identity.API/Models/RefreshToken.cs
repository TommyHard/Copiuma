namespace Identity.API.Models;

public class RefreshToken
{
    public Guid Id { get; set; }
    public required string Token { get; set; }
    public DateTime ExpiryDate { get; set; }
    public bool IsRevoked { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

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