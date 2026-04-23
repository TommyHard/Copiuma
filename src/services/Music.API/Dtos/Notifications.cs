using System.Text.Json;

namespace Music.API.Dtos;

public record NotificationResponse(
    Guid Id,
    string Type,
    JsonElement Payload,
    bool IsRead,
    DateTime CreatedAt);

public record InviteToPlaylistRequest(
    Guid InviteeId,
    string Role);

public record InvitationResponse(
    Guid Id,
    Guid PlaylistId,
    string PlaylistTitle,
    Guid InviterId,
    string? InviterName,
    string ProposedRole,
    string Status,
    DateTime CreatedAt);
