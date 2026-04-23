namespace Music.API.Dtos;

public class TrackUploadDto
{
    public required IFormFile File { get; set; }
    public required string Title { get; set; }
    public required string Artist { get; set; }
}