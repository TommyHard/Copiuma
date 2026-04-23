namespace Identity.API.Models;

public class UserPreferences
{
    public Guid Id { get; set; }

    public Guid UserId { get; set; }
    public User? User { get; set; }

    public string[] FavoriteGenres { get; set; } = Array.Empty<string>();

    public string Language { get; set; } = "ru";
}