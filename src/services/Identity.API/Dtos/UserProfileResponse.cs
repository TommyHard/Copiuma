namespace Identity.API.Dtos;

public record UserProfileResponse(
    Guid Id,
    string Email,
    string? DisplayName,
    string? Bio,
    string? AvatarKey,
    string[] FavoriteGenres,
    string Language
);