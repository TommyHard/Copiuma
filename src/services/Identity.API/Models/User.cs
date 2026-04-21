namespace Identity.API.Models;

public class User
{
    // Уникальный идентификатор
    public Guid Id { get; set; }

    public required string Email { get; set; }

    public required string PasswordHash { get; set; }

    public string? DisplayName { get; set; }

    // Дата регистрации
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}