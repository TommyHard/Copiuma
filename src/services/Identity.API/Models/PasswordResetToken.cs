namespace Identity.API.Models;

/// <summary>
/// Auth-hardening: одноразовый токен сброса пароля.
/// Аналогично <see cref="EmailVerificationToken"/> — храним только хэш
///
/// Default TTL = 1 час
/// </summary>
public class PasswordResetToken
{
    public Guid Id { get; set; }

    public required string TokenHash { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime? ConsumedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Guid UserId { get; set; }
    public User? User { get; set; }
}