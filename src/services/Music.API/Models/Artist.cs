using NpgsqlTypes;

namespace Music.API.Models;

public class Artist
{
    public Guid Id { get; set; }

    public required string Name { get; set; }

    public string? Bio { get; set; }

    public string? AvatarKey { get; set; }

    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public NpgsqlTsVector? SearchVector { get; set; }
}
