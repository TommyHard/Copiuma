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

        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        Guid uploaderId = Guid.Empty;

        if (!string.IsNullOrEmpty(userIdString) && Guid.TryParse(userIdString, out var parsedId))
        {
            uploaderId = parsedId;
        }

        var track = new Track
        {
            Id = Guid.NewGuid(),
            Title = request.Title,
            Artist = request.Artist,
            FileName = savedFileName,
            ContentType = request.File.ContentType,
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = uploaderId
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

    [HttpGet("favorites")]
    public async Task<IActionResult> GetFavoriteTracks()
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            return Unauthorized("Пользователь не авторизован или запрос пришел не через Gateway");
        }

        var favoriteTracks = await _context.LikedTracks
            .Where(l => l.UserId == userId)
            .Include(l => l.Track)
            .OrderByDescending(l => l.LikedAt)
            .Select(l => new
            {
                l.Track!.Id,
                l.Track.Title,
                l.Track.Artist,
                LikedAt = l.LikedAt
            })
            .ToListAsync();

        return Ok(favoriteTracks);
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

    [HttpPost("{id}/like")]
    public async Task<IActionResult> ToggleLike(Guid id)
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            return Unauthorized("Пользователь не авторизован или запрос пришел не через Gateway");
        }

        var track = await _context.Tracks.FindAsync(id);
        if (track == null) return NotFound("Трек не найден");

        var existingLike = await _context.LikedTracks
            .FirstOrDefaultAsync(l => l.UserId == userId && l.TrackId == id);

        if (existingLike != null)
        {
            _context.LikedTracks.Remove(existingLike);
            await _context.SaveChangesAsync();
            return Ok(new { Message = "Трек удален из избранного", IsLiked = false });
        }

        var like = new LikedTrack
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TrackId = id
        };

        _context.LikedTracks.Add(like);
        await _context.SaveChangesAsync();

        return Ok(new { Message = "Трек добавлен в избранное", IsLiked = true });
    }
}