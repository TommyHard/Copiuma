using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
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
    public async Task<IActionResult> UploadTrack([FromForm] UploadTrackRequest request)
    {
        if (request.File == null || request.File.Length == 0) return BadRequest("Файл не выбран или пуст");
        if (!request.File.ContentType.Contains("audio")) return BadRequest("Пожалуйста, загрузите аудиофайл");
        if (string.IsNullOrWhiteSpace(request.Title)) return BadRequest("Название трека обязательно");

        using var stream = request.File.OpenReadStream();
        var savedFileName = await _storageService.UploadFileAsync(stream, request.File.FileName, request.File.ContentType);

        var track = new Track
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Artist = request.Artist,
            FileName = savedFileName,
            ContentType = request.File.ContentType,
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

    [HttpGet]
    public async Task<IActionResult> GetAllTracks()
    {
        var tracks = await _context.Tracks
            .OrderByDescending(t => t.UploadedAt)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Artist,
                t.UploadedAt
            })
            .ToListAsync();

        return Ok(tracks);
    }

    [HttpGet("{id}/play")]
    public async Task<IActionResult> PlayTrack(Guid id)
    {
        var track = await _context.Tracks.FindAsync(id);

        if (track == null)
        {
            return NotFound("Трек не найден в базе данных");
        }

        var stream = await _storageService.GetFileStreamAsync(track.FileName);

        return File(stream, track.ContentType, enableRangeProcessing: true);
    }
}