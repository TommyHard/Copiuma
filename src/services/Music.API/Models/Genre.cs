namespace Music.API.Models;

public class Genre
{
    public Guid Id { get; set; }

    public required string Slug { get; set; }

    public required string DisplayName { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}