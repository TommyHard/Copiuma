namespace Music.API.Dtos;

public record CreatePlaylistRequest(
    string Title,
    string Visibility = "Private"
);