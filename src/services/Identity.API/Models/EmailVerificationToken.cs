namespace Identity.API.Models;

/// <summary>
/// Auth-hardening: одноразовый токен подтверждения email
///
/// Хранится HASH токена (SHA256 hex), а не сам токен. В письмо уходит plaintext;
/// при проверке хэшируем входящий и сравниваем. Утечка БД не даёт возможности
/// «пройти» верификацию задним числом
///
/// Default TTL = 24 часа. По истечении пользователь может запросить новый через
/// POST /auth/resend-verification
/// </summary>
public class EmailVerificationToken
{
    public Guid Id { get; set; }

    /// <summary>
    /// SHA256-hex от plaintext-токена
    /// </summary>
    public required string TokenHash { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime? ConsumedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Guid UserId { get; set; }
    public User? User { get; set; }
}