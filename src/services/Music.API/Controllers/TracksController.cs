using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using Music.API.Services;
using StackExchange.Redis;
using System.Security.Claims;
using System.Text.Json;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class TracksController : ControllerBase
{
    private readonly FileStorageService _storage;
    private readonly AppDbContext _context;
    private readonly MessageBusClient _bus;
    private readonly IDistributedCache _cache;
    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<TracksController> _log;

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
        "audio/flac", "audio/ogg", "audio/webm", "audio/aac", "audio/mp4"
    };

    public TracksController(
        FileStorageService storage,
        AppDbContext context,
        MessageBusClient bus,
        IDistributedCache cache,
        IConnectionMultiplexer redis,
        ILogger<TracksController> log)
    {
        _storage = storage;
        _context = context;
        _bus = bus;
        _cache = cache;
        _redis = redis;
        _log = log;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private const string CacheVersionKey = "tracks:version";

    private async Task<long> GetCacheVersionAsync()
    {
        var db = _redis.GetDatabase();
        var v = await db.StringGetAsync(CacheVersionKey);
        return v.HasValue ? (long)v : 0L;
    }

    private async Task BumpCacheVersionAsync()
    {
        var db = _redis.GetDatabase();
        await db.StringIncrementAsync(CacheVersionKey);
    }

    [HttpPost("upload")]
    [RequestSizeLimit(200_000_000)] // 200 MB upper bound
    public async Task<IActionResult> UploadTrack([FromForm] UploadTrackRequest request)
    {
        if (request.File is null || request.File.Length == 0)
            return BadRequest("Файл не выбран или пуст.");

        if (!AllowedContentTypes.Contains(request.File.ContentType))
            return BadRequest($"Недопустимый content-type: {request.File.ContentType}.");

        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest("Название трека обязательно.");

        string? artistName = request.Artist?.Trim();
        if (request.ArtistId.HasValue)
        {
            var artist = await _context.Artists.FindAsync(request.ArtistId.Value);
            if (artist is null) return BadRequest("Указанный артист не найден.");
            artistName = artist.Name;
        }

        if (request.AlbumId.HasValue)
        {
            if (!request.ArtistId.HasValue)
                return BadRequest("Для AlbumId нужно указать ArtistId.");
            var album = await _context.Albums.FindAsync(request.AlbumId.Value);
            if (album is null) return BadRequest("Указанный альбом не найден.");
            if (album.ArtistId != request.ArtistId.Value)
                return BadRequest("Альбом принадлежит другому артисту.");
        }

        await using var stream = request.File.OpenReadStream();
        var savedFileName = await _storage.UploadFileAsync(
            stream, request.File.FileName, request.File.ContentType, request.File.Length);

        var track = new Track
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Artist = artistName,
            ArtistId = request.ArtistId,
            AlbumId = request.AlbumId,
            TrackNumber = request.AlbumId.HasValue ? request.TrackNumber : null,
            FileName = savedFileName,
            ContentType = request.File.ContentType,
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = UserId
        };

        _context.Tracks.Add(track);
        await _context.SaveChangesAsync();

        try
        {
            await _bus.PublishNewTrackEventAsync(track.Id);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Не удалось опубликовать событие TrackUploaded для {TrackId}.", track.Id);
        }

        await BumpCacheVersionAsync();

        return Ok(new { Message = "Трек загружен.", TrackId = track.Id, FileName = savedFileName });
    }

    [HttpGet]
    public async Task<IActionResult> GetAllTracks([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var version = await GetCacheVersionAsync();
        var cacheKey = $"tracks:v{version}:page{page}:size{pageSize}";

        var cached = await _cache.GetStringAsync(cacheKey);
        if (!string.IsNullOrEmpty(cached))
        {
            return Content(cached, "application/json");
        }

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
                t.UploadedAt,
                t.ArtistId,
                t.AlbumId,
                t.TrackNumber
            })
            .ToListAsync();

        var payload = JsonSerializer.Serialize(tracks);
        await _cache.SetStringAsync(cacheKey, payload, new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1)
        });

        return Content(payload, "application/json");
    }

    [HttpGet("favorites")]
    public async Task<IActionResult> GetFavoriteTracks()
    {
        var userId = UserId;
        var favs = await _context.LikedTracks
            .Where(l => l.UserId == userId)
            .Include(l => l.Track)
            .OrderByDescending(l => l.LikedAt)
            .Select(l => new { l.Track!.Id, l.Track.Title, l.Track.Artist, l.LikedAt })
            .ToListAsync();

        return Ok(favs);
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchTracks([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest("Поисковой запрос не может быть пустым.");

        var tracks = await _context.Tracks
            .Where(t => t.SearchVector!.Matches(EF.Functions.WebSearchToTsQuery("russian", q)))
            .Select(t => new { t.Id, t.Title, t.Artist, t.Duration, t.UploadedAt })
            .Take(20)
            .ToListAsync();

        return Ok(tracks);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTrack(Guid id)
    {
        var userId = UserId;
        var track = await _context.Tracks.FindAsync(id);
        if (track is null) return NotFound();

        if (track.UploadedByUserId != userId)
            return Forbid();

        try { await _storage.DeleteFileAsync(track.FileName); }
        catch (Exception ex) { _log.LogWarning(ex, "Файл {File} уже отсутствует в MinIO.", track.FileName); }

        _context.Tracks.Remove(track);
        await _context.SaveChangesAsync();
        await BumpCacheVersionAsync();

        return Ok(new { Message = "Трек удалён." });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetTrackById(Guid id)
    {
        var track = await _context.Tracks
            .Where(t => t.Id == id)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Artist,
                t.Duration,
                t.ArtistId,
                t.AlbumId,
                t.TrackNumber
            })
            .FirstOrDefaultAsync();

        return track is null ? NotFound() : Ok(track);
    }

    [HttpGet("{id}/play")]
    public async Task<IActionResult> PlayTrack(Guid id, [FromQuery] bool inline = false)
    {
        var track = await _context.Tracks.FindAsync(id);
        if (track is null) return NotFound("Трек не найден.");

        if (!inline)
        {
            var url = await _storage.GeneratePresignedGetUrlAsync(track.FileName, expirySeconds: 900);
            return Redirect(url);
        }

        var stat = await _storage.StatAsync(track.FileName);
        if (!stat.Exists) return NotFound("Файл отсутствует в хранилище.");

        Response.ContentType = track.ContentType;
        Response.ContentLength = stat.Size;
        Response.Headers["Accept-Ranges"] = "bytes";

        await _storage.StreamToAsync(track.FileName, Response.Body, HttpContext.RequestAborted);
        return new EmptyResult();
    }

    /// <summary>
    /// Клиент репортит проигранный трек (или попытку).
    /// Рекомендации: popular/similar/for-you строятся на этих событиях
    /// PlayedMs - длительность реального воспроизведения в мс. 
    /// Completed - true, если дослушали до конца (клиент сам решает по >= 90%).
    /// </summary>
    [HttpPost("{id}/play-event")]
    public async Task<IActionResult> ReportPlay(
        Guid id,
        [FromBody] ReportPlayRequest request,
        CancellationToken ct = default)
    {
        if (request.PlayedMs < 0) return BadRequest("PlayedMs не может быть отрицательным.");

        if (!await _context.Tracks.AnyAsync(t => t.Id == id, ct))
            return NotFound("Трек не найден.");

        _context.PlayEvents.Add(new PlayEvent
        {
            Id = Guid.NewGuid(),
            UserId = UserId,
            TrackId = id,
            PlayedMs = request.PlayedMs,
            Completed = request.Completed,
            Source = string.IsNullOrWhiteSpace(request.Source) ? null : request.Source!.Trim(),
            StartedAt = DateTime.UtcNow
        });

        await _context.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id}/like")]
    public async Task<IActionResult> ToggleLike(Guid id)
    {
        var userId = UserId;
        var trackExists = await _context.Tracks.AnyAsync(t => t.Id == id);
        if (!trackExists) return NotFound("Трек не найден.");

        var existing = await _context.LikedTracks
            .FirstOrDefaultAsync(l => l.UserId == userId && l.TrackId == id);

        if (existing is not null)
        {
            _context.LikedTracks.Remove(existing);
            await _context.SaveChangesAsync();
            return Ok(new { IsLiked = false });
        }

        _context.LikedTracks.Add(new LikedTrack
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TrackId = id
        });
        await _context.SaveChangesAsync();

        return Ok(new { IsLiked = true });
    }
}