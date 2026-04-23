namespace Identity.API.Dtos;

public record UserProfileResponse(
    Guid Id,
    string Email,
    string? DisplayName,
    string[] FavoriteGenres,
    string Language
);