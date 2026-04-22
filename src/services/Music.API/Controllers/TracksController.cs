using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using Music.API.Services;
using System.Text.Json;

namespace Music.API.Controllers;

[ApiController]
[Route("[controller]")]
public class TracksController : ControllerBase
{
    private readonly FileStorageService _storageService;
    private readonly AppDbContext _context;
    private readonly MessageBusClient _messageBusClient;
    private readonly IDistributedCache _cache;

    public TracksController(FileStorageService storageService, AppDbContext context, MessageBusClient messageBusClient, IDistributedCache cache)
    {
        _storageService = storageService;
        _context = context;
        _messageBusClient = messageBusClient;
        _cache = cache;
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

        _messageBusClient.PublishNewTrackEvent(track.Id);

        return Ok(new
        {
            Message = "Трек успешно загружен в облако и сохранен в базу",
            TrackId = track.Id,
            FileName = savedFileName
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAllTracks([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        var cacheKey = $"tracks_page_{page}_size_{pageSize}";

        var cachedData = await _cache.GetStringAsync(cacheKey);
        if (!string.IsNullOrEmpty(cachedData))
        {
            Console.WriteLine($"--> [CACHE HIT] Отдаем треки из Redis (Страница {page})");
            return Ok(JsonSerializer.Deserialize<object>(cachedData));
        }

        Console.WriteLine($"--> [DB HIT] Получаем в PostgreSQL треки (Страница {page})");

        var tracks = await _context.Tracks
            .OrderByDescending(t => t.UploadedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Artist,
                t.Duration,
                t.UploadedAt
            })
            .ToListAsync();

        var cacheOptions = new DistributedCacheEntryOptions()
            .SetAbsoluteExpiration(TimeSpan.FromSeconds(30));

        await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(tracks), cacheOptions);

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