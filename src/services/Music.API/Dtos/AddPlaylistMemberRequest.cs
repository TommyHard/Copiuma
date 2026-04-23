namespace Music.API.Dtos;

public record AddPlaylistMemberRequest(
    Guid TargetUserId,
    string Role
);