using Microsoft.AspNetCore.Mvc;
using Music.API.Data;
using Music.API.Models;
using Music.API.Services;

namespace Music.API.Controllers;

[ApiController]
[Route("[controller]")]
public class TracksController : ControllerBase
{
    private readonly FileStorageService _storageService;
    private readonly AppDbContext _context;

    public TracksController(FileStorageService storageService, AppDbContext context)
    {
        _storageService = storageService;
        _context = context;
    }

    [HttpPost("upload")]
    public async Task<IActionResult> UploadTrack(
        [FromForm] IFormFile? file,
        [FromForm] string title,
        [FromForm] string? artist)
    {
        if (file == null || file.Length == 0) return BadRequest("Файл не выбран или пуст");
        if (!file.ContentType.Contains("audio")) return BadRequest("Загрузите аудиофайл");
        if (string.IsNullOrWhiteSpace(title)) return BadRequest("Название трека обязательно");

        using var stream = file.OpenReadStream();
        var savedFileName = await _storageService.UploadFileAsync(stream, file.FileName, file.ContentType);

        var track = new Track
        {
            Id = Guid.NewGuid(),
            Title = title,
            Artist = artist,
            FileName = savedFileName,
            ContentType = file.ContentType,
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = Guid.Empty
        };

        _context.Tracks.Add(track);
        await _context.SaveChangesAsync();

        return Ok(new
        {
            Message = "Трек успешно загружен в облако и сохранен в базу",
            TrackId = track.Id,
            FileName = savedFileName
        });
    }
}