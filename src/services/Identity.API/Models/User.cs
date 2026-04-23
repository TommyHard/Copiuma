namespace Identity.API.Models;

public class User
{
    public Guid Id { get; set; }

    public required string Email { get; set; }

    public required string PasswordHash { get; set; }

    public string? DisplayName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public UserPreferences? Preferences { get; set; }
    public List<RefreshToken> RefreshTokens { get; set; } = new();
}