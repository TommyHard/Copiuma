namespace Identity.API.Models;

public class User
{
    public Guid Id { get; set; }

    public required string Email { get; set; }

    public required string PasswordHash { get; set; }

    public string? DisplayName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Default User; апгрейд до Artist по запросу пользователя
    /// </summary>
    public UserRole Role { get; set; } = UserRole.User;

    /// <summary>
    /// null = ещё не подтвердил email. Записи в Music.API заблокированы, пока null
    /// </summary>
    public DateTime? EmailVerifiedAt { get; set; }

    /// <summary>
    /// Когда последний раз менялся пароль (включая reset)
    /// </summary>
    public DateTime? PasswordChangedAt { get; set; }

    public UserPreferences? Preferences { get; set; }
    public List<RefreshToken> RefreshTokens { get; set; } = new();
    public List<EmailVerificationToken> EmailVerificationTokens { get; set; } = new();
    public List<PasswordResetToken> PasswordResetTokens { get; set; } = new();
}