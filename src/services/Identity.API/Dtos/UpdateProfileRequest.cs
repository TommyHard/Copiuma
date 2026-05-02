namespace Identity.API.Dtos;

public record UpdateProfileRequest(
    string? DisplayName,
    string? Bio,
    string[] FavoriteGenres,
    string Language
);