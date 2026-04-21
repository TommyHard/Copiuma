namespace Music.API.Dtos;

public class UploadTrackRequest
{
    public required IFormFile File { get; set; }
    public required string Title { get; set; }

    public string? Artist { get; set; }
}