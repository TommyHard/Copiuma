namespace Identity.API.Dtos;

public record UpdateProfileRequest(
    string? DisplayName,
    string[] FavoriteGenres,
    string Language
);