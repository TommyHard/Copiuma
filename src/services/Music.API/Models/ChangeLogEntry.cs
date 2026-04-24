namespace Music.API.Models;

public enum ChangeKind
{
    Created = 0,
    Updated = 1,
    Deleted = 2
}

public class ChangeLogEntry
{
    public Guid Id { get; set; }

    public required string EntityType { get; set; }
    public Guid EntityId { get; set; }

    public ChangeKind Kind { get; set; }

    public Guid? ActorUserId { get; set; }

    public required string Changes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}