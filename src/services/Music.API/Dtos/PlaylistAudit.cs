namespace Music.API.Dtos;

public record PlaylistAudit(
    Guid Id,
    string EntityType,
    int ChangeKind,
    Guid? ActorUserId,
    string Changes,
    DateTime CreatedAt,
    string? TrackTitle
);