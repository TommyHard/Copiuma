using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using Music.API.Services;
using Music.API.Telemetry;
using Music.Shared.Contracts.Audio;
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
    private readonly ModerationService _moderation;
    private readonly ILogger<TracksController> _log;

    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
        "audio/flac", "audio/ogg", "audio/webm", "audio/aac", "audio/mp4"
    };

    /// <summary>
    /// camelCase для ручной сериализации ответов кэша
    /// </summary>
    private static readonly JsonSerializerOptions CamelCaseJson = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    public TracksController(
        FileStorageService storage,
        AppDbContext context,
        MessageBusClient bus,
        IDistributedCache cache,
        IConnectionMultiplexer redis,
        ModerationService moderation,
        ILogger<TracksController> log)
    {
        _storage = storage;
        _context = context;
        _bus = bus;
        _cache = cache;
        _redis = redis;
        _moderation = moderation;
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

    internal static List<string> NormalizeGenres(IEnumerable<string>? input)
    {
        if (input is null) return new List<string>();
        return input
            .Where(g => !string.IsNullOrWhiteSpace(g))
            .Select(g => g.Trim().ToLowerInvariant())
            .Distinct(StringComparer.Ordinal)
            .ToList();
    }

    [HttpPost("upload")]
    [Authorize(Policy = "ArtistOnly")]
    [RequestSizeLimit(200_000_000)]
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

        var normalizedGenres = NormalizeGenres(request.Genres);

        var trackId = Guid.NewGuid();

        // Собственная обложка трека
        string? coverKey = null;
        if (request.Cover is { Length: > 0 } cover)
        {
            if (!FileStorageService.IsAllowedImageContentType(cover.ContentType))
                return BadRequest($"Недопустимый content-type обложки: {cover.ContentType}.");
            await using var coverStream = cover.OpenReadStream();
            coverKey = await _storage.UploadImageAsync(
                coverStream, cover.FileName, cover.ContentType, cover.Length, $"tracks/{trackId}");
        }

        var track = new Track
        {
            Id = trackId,
            Title = request.Title.Trim(),
            Artist = artistName,
            ArtistId = request.ArtistId,
            AlbumId = request.AlbumId,
            TrackNumber = request.AlbumId.HasValue ? request.TrackNumber : null,
            CoverKey = coverKey,
            Genres = normalizedGenres,
            FileName = savedFileName,
            ContentType = request.File.ContentType,
            UploadedAt = DateTime.UtcNow,
            UploadedByUserId = UserId
        };

        _context.Tracks.Add(track);

        if (normalizedGenres.Count > 0)
        {
            var genreEntities = await _context.Genres
                .Where(g => normalizedGenres.Contains(g.Slug))
                .ToListAsync();
            foreach (var ge in genreEntities)
            {
                _context.TrackGenres.Add(new Models.TrackGenre
                {
                    TrackId = track.Id,
                    GenreId = ge.Id
                });
            }
        }

        if (request.FeaturedArtistIds is { Count: > 0 })
        {
            var validArtistIds = await _context.Artists
                .Where(a => request.FeaturedArtistIds.Contains(a.Id))
                .Select(a => a.Id)
                .ToListAsync();
            for (int i = 0; i < validArtistIds.Count; i++)
            {
                _context.TrackFeaturedArtists.Add(new Models.TrackFeaturedArtist
                {
                    TrackId = track.Id,
                    ArtistId = validArtistIds[i],
                    Position = i
                });
            }
        }

        await _context.SaveChangesAsync();

        CopiumaMetrics.TracksUploaded.Add(1);

        try
        {
            await _bus.PublishAudioProcessingJobAsync(track.Id, source: "upload");
        }
        catch (Exception ex)
        {
            _log.LogError(ex,
                "Не удалось опубликовать AudioProcessingJob для {TrackId}. Будет подхвачен recovery'ей при старте воркера.",
                track.Id);
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
            return Content(cached, "application/json");

        var visibleTracks = _moderation.ApplyVisibilityFilter(_context.Tracks, UserId);

        var tracksRaw = await visibleTracks
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
                t.TrackNumber,
                t.IsExplicit,
                t.CoverKey,
                AlbumCoverKey = t.Album != null ? t.Album.CoverKey : null,
                IsLikedByMe = _context.LikedTracks.Any(l => l.TrackId == t.Id && l.UserId == UserId),
                FeaturedArtists = _context.TrackFeaturedArtists
                    .Where(fa => fa.TrackId == t.Id)
                    .OrderBy(fa => fa.Position)
                    .Select(fa => new { fa.Artist!.Id, fa.Artist.Name })
                    .ToList()
            })
            .ToListAsync();

        var tracksToCache = new List<object>(tracksRaw.Count);
        foreach (var t in tracksRaw)
        {
            var key = t.CoverKey ?? t.AlbumCoverKey;
            var url = key != null ? await _storage.GeneratePresignedImageGetUrlAsync(key) : null;

            tracksToCache.Add(new
            {
                t.Id,
                t.Title,
                t.Artist,
                t.Duration,
                t.UploadedAt,
                t.ArtistId,
                t.AlbumId,
                t.TrackNumber,
                t.IsExplicit,
                CoverUrl = url,
                t.IsLikedByMe,
                t.FeaturedArtists
            });
        }

        var payload = JsonSerializer.Serialize(tracksToCache, CamelCaseJson);
        await _cache.SetStringAsync(cacheKey, payload, new DistributedCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(1)
        });

        return Content(payload, "application/json");
    }

    [HttpGet("favorites")]
    public async Task<IActionResult> GetFavorites(CancellationToken ct)
    {
        var userId = Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        var rows = await _context.LikedTracks
            .Where(lt => lt.UserId == userId)
            .OrderByDescending(lt => lt.LikedAt)
            .Select(lt => new
            {
                Id = lt.Track!.Id,
                Title = lt.Track.Title,
                Artist = lt.Track.Artist,
                ArtistId = lt.Track.ArtistId,
                Duration = lt.Track.Duration,
                AlbumId = lt.Track.AlbumId,
                AlbumTitle = lt.Track.Album != null ? lt.Track.Album.Title : null,
                CoverKey = lt.Track.CoverKey ?? (lt.Track.Album != null ? lt.Track.Album.CoverKey : null),
                LikedAt = lt.LikedAt,
                FeaturedArtists = _context.TrackFeaturedArtists
                    .Where(fa => fa.TrackId == lt.Track.Id)
                    .OrderBy(fa => fa.Position)
                    .Select(fa => new { fa.Artist!.Id, fa.Artist.Name })
                    .ToList()
            })
            .ToListAsync(ct);

        var favorites = new List<object>(rows.Count);
        foreach (var r in rows)
        {
            var coverUrl = r.CoverKey is null
                ? null
                : await _storage.GeneratePresignedImageGetUrlAsync(r.CoverKey);

            favorites.Add(new
            {
                r.Id,
                r.Title,
                r.Artist,
                r.ArtistId,
                r.Duration,
                r.AlbumId,
                r.AlbumTitle,
                CoverUrl = coverUrl,
                r.LikedAt,
                r.FeaturedArtists
            });
        }

        return Ok(favorites);
    }

    [HttpGet("search")]
    public async Task<IActionResult> SearchTracks([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest("Поисковой запрос не может быть пустым.");

        var raw = await _moderation.ApplyVisibilityFilter(_context.Tracks, UserId)
            .Where(t => t.SearchVector!.Matches(EF.Functions.WebSearchToTsQuery("russian", q)))
            .Select(t => new {
                t.Id,
                t.Title,
                t.Artist,
                t.Duration,
                t.UploadedAt,
                t.ArtistId,
                t.AlbumId,
                t.TrackNumber,
                t.IsExplicit,
                t.CoverKey,
                AlbumCoverKey = t.Album != null ? t.Album.CoverKey : null,
                IsLikedByMe = _context.LikedTracks.Any(l => l.TrackId == t.Id && l.UserId == UserId),
                FeaturedArtists = _context.TrackFeaturedArtists
                    .Where(fa => fa.TrackId == t.Id)
                    .OrderBy(fa => fa.Position)
                    .Select(fa => new { fa.Artist!.Id, fa.Artist.Name })
                    .ToList()
            })
            .Take(20)
            .ToListAsync();

        var tracks = new List<object>(raw.Count);
        foreach (var t in raw)
        {
            var key = t.CoverKey ?? t.AlbumCoverKey;
            var url = key != null ? await _storage.GeneratePresignedImageGetUrlAsync(key) : null;
            tracks.Add(new
            {
                t.Id,
                t.Title,
                t.Artist,
                t.Duration,
                t.UploadedAt,
                t.ArtistId,
                t.AlbumId,
                t.TrackNumber,
                t.IsExplicit,
                CoverUrl = url,
                t.IsLikedByMe,
                t.FeaturedArtists
            });
        }

        return Ok(tracks);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateTrack(Guid id, [FromBody] UpdateTrackRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest("Название трека обязательно.");

        var track = await _context.Tracks.FindAsync(id);
        if (track is null || track.DeletedAt != null) return NotFound();

        if (track.UploadedByUserId != UserId)
            return Forbid();

        var normalizedGenres = NormalizeGenres(request.Genres);

        track.Title = request.Title.Trim();
        track.Genres = normalizedGenres;
        track.IsExplicit = request.IsExplicit;

        var existingLinks = await _context.TrackGenres
            .Where(tg => tg.TrackId == id)
            .ToListAsync();
        _context.TrackGenres.RemoveRange(existingLinks);

        if (normalizedGenres.Count > 0)
        {
            var genreEntities = await _context.Genres
                .Where(g => normalizedGenres.Contains(g.Slug))
                .ToListAsync();
            foreach (var ge in genreEntities)
            {
                _context.TrackGenres.Add(new Models.TrackGenre
                {
                    TrackId = id,
                    GenreId = ge.Id
                });
            }
        }

        var existingFeatured = await _context.TrackFeaturedArtists
            .Where(fa => fa.TrackId == id)
            .ToListAsync();
        _context.TrackFeaturedArtists.RemoveRange(existingFeatured);

        if (request.FeaturedArtistIds is { Count: > 0 })
        {
            var validArtistIds = await _context.Artists
                .Where(a => request.FeaturedArtistIds.Contains(a.Id))
                .Select(a => a.Id)
                .ToListAsync();
            for (int i = 0; i < validArtistIds.Count; i++)
            {
                _context.TrackFeaturedArtists.Add(new Models.TrackFeaturedArtist
                {
                    TrackId = id,
                    ArtistId = validArtistIds[i],
                    Position = i
                });
            }
        }

        await _context.SaveChangesAsync();
        await BumpCacheVersionAsync();

        return Ok(new
        {
            track.Id,
            track.Title,
            track.Genres,
            track.IsExplicit
        });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteTrack(Guid id)
    {
        var userId = UserId;
        var track = await _context.Tracks.FindAsync(id);
        if (track is null || track.DeletedAt != null) return NotFound();

        if (track.UploadedByUserId != userId)
            return Forbid();

        track.DeletedAt = DateTime.UtcNow;
        track.DeletionReason = TrackDeletionReason.SelfDeleted;
        await _context.SaveChangesAsync();
        await BumpCacheVersionAsync();

        return Ok(new { Message = "Трек удалён.", DeletedAt = track.DeletedAt });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetTrackById(Guid id)
    {
        var track = await _moderation.ApplyVisibilityFilter(_context.Tracks, UserId)
            .Where(t => t.Id == id)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Artist,
                t.Duration,
                t.ArtistId,
                t.AlbumId,
                AlbumTitle = t.Album != null ? t.Album.Title : null,
                t.TrackNumber,
                t.IsExplicit,
                t.Genres,
                t.ProcessingStatus,
                t.CoverKey,
                AlbumCoverKey = t.Album != null ? t.Album.CoverKey : null,
                IsLikedByMe = _context.LikedTracks.Any(l => l.TrackId == id && l.UserId == UserId),
                UploadedByUserId = t.UploadedByUserId,
                FeaturedArtists = _context.TrackFeaturedArtists
                    .Where(fa => fa.TrackId == id)
                    .OrderBy(fa => fa.Position)
                    .Select(fa => new { fa.Artist!.Id, fa.Artist!.Name })
                    .ToList()
            })
            .FirstOrDefaultAsync();

        if (track is null) return NotFound();

        // Своя обложка трека -> fallback на обложку альбома
        var effectiveCoverKey = track.CoverKey ?? track.AlbumCoverKey;
        var coverUrl = effectiveCoverKey is null
            ? null
            : await _storage.GeneratePresignedImageGetUrlAsync(effectiveCoverKey);
        var ownCoverUrl = track.CoverKey is null
            ? null
            : await _storage.GeneratePresignedImageGetUrlAsync(track.CoverKey);

        return Ok(new
        {
            track.Id,
            track.Title,
            track.Artist,
            track.Duration,
            track.ArtistId,
            track.AlbumId,
            track.AlbumTitle,
            track.TrackNumber,
            track.IsExplicit,
            track.Genres,
            track.ProcessingStatus,
            CoverUrl = coverUrl,
            OwnCoverUrl = ownCoverUrl,
            HasOwnCover = track.CoverKey != null,
            track.IsLikedByMe,
            track.UploadedByUserId,
            track.FeaturedArtists
        });
    }

    /// <summary>
    /// Загрузка/замена собственной обложки трека
    /// Если у трека уже была обложка — старая чистится
    /// </summary>
    [HttpPost("{id:guid}/cover")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> UploadCover(Guid id, IFormFile file)
    {
        if (file is null || file.Length == 0) return BadRequest("Файл пуст.");
        if (!FileStorageService.IsAllowedImageContentType(file.ContentType))
            return BadRequest($"Недопустимый content-type: {file.ContentType}.");

        var track = await _context.Tracks.FindAsync(id);
        if (track is null || track.DeletedAt != null) return NotFound();
        if (track.UploadedByUserId != UserId) return Forbid();

        await using var stream = file.OpenReadStream();
        var key = await _storage.UploadImageAsync(
            stream, file.FileName, file.ContentType, file.Length, $"tracks/{id}");

        var oldKey = track.CoverKey;
        track.CoverKey = key;
        await _context.SaveChangesAsync();

        if (oldKey is not null)
        {
            try { await _storage.DeleteImageAsync(oldKey); } catch { }
        }

        await BumpCacheVersionAsync();

        var url = await _storage.GeneratePresignedImageGetUrlAsync(key);
        return Ok(new { coverUrl = url });
    }

    /// <summary>
    /// Удаляет собственную обложку трека. После этого трек снова наследует обложку альбома
    /// </summary>
    [HttpDelete("{id:guid}/cover")]
    public async Task<IActionResult> DeleteCover(Guid id)
    {
        var track = await _context.Tracks.FindAsync(id);
        if (track is null || track.DeletedAt != null) return NotFound();
        if (track.UploadedByUserId != UserId) return Forbid();
        if (track.CoverKey is null) return NoContent();

        try { await _storage.DeleteImageAsync(track.CoverKey); } catch { }
        track.CoverKey = null;
        await _context.SaveChangesAsync();
        await BumpCacheVersionAsync();
        return NoContent();
    }

    // Lyrics (LRC)

    /// <summary>
    /// Возвращает LRC-текст трека. Если текста нет — 204
    /// </summary>
    [HttpGet("{id:guid}/lyrics")]
    [AllowAnonymous]
    public async Task<IActionResult> GetLyrics(Guid id, CancellationToken ct)
    {
        var track = await _context.Tracks
            .AsNoTracking()
            .Where(t => t.Id == id && t.DeletedAt == null)
            .Select(t => new { t.Id, t.Lyrics })
            .FirstOrDefaultAsync(ct);

        if (track is null) return NotFound();
        if (string.IsNullOrEmpty(track.Lyrics)) return NoContent();

        return Ok(new { trackId = track.Id, lyrics = track.Lyrics });
    }

    public record SetLyricsRequest(string Lyrics);

    /// <summary>
    /// Загрузить/обновить LRC-текст трека. Доступно автору трека
    /// </summary>
    [HttpPut("{id:guid}/lyrics")]
    public async Task<IActionResult> SetLyrics(Guid id, [FromBody] SetLyricsRequest req, CancellationToken ct)
    {
        if (req?.Lyrics is null) return BadRequest("Body.lyrics обязателен.");
        if (req.Lyrics.Length > 64 * 1024) return BadRequest("Слишком длинный текст (макс. 64KB).");

        var track = await _context.Tracks.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (track is null || track.DeletedAt != null) return NotFound();
        if (track.UploadedByUserId != UserId) return Forbid();

        track.Lyrics = string.IsNullOrWhiteSpace(req.Lyrics) ? null : req.Lyrics;
        await _context.SaveChangesAsync(ct);
        return NoContent();
    }

    /// <summary>
    /// Удалить LRC-текст трека. Доступно автору
    /// </summary>
    [HttpDelete("{id:guid}/lyrics")]
    public async Task<IActionResult> DeleteLyrics(Guid id, CancellationToken ct)
    {
        var track = await _context.Tracks.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (track is null || track.DeletedAt != null) return NotFound();
        if (track.UploadedByUserId != UserId) return Forbid();
        if (track.Lyrics is null) return NoContent();

        track.Lyrics = null;
        await _context.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpGet("{id}/play")]
    public async Task<IActionResult> PlayTrack(Guid id, [FromQuery] bool inline = false)
    {
        CopiumaMetrics.PlaybackRequests.Add(1);

        var track = await _context.Tracks.FindAsync(id);
        if (track is null) return NotFound("Трек не найден.");

        if (track.DeletedAt != null) return NotFound("Трек недоступен.");

        if (track.UploadedByUserId != UserId &&
            await _moderation.IsShadowbannedAsync(track.UploadedByUserId))
            return NotFound("Трек недоступен.");

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

        // Merge приоритет: лайк отменяет дизлайк
        var dislike = await _context.UserDislikes
            .FirstOrDefaultAsync(d => d.UserId == userId && d.TargetType == DislikeTargetType.Track && d.TargetId == id);
        if (dislike != null)
        {
            _context.UserDislikes.Remove(dislike);
        }

        await _context.SaveChangesAsync();

        return Ok(new { IsLiked = true });
    }

    [HttpGet("{id}/status")]
    public async Task<IActionResult> GetProcessingStatus(Guid id, CancellationToken ct)
    {
        var t = await _context.Tracks
            .Where(t => t.Id == id)
            .Select(t => new { t.Id, t.ProcessingStatus, HasWaveform = t.WaveformPeaks != null, t.Duration, t.DeletedAt })
            .FirstOrDefaultAsync(ct);
        if (t is null || t.DeletedAt != null) return NotFound();

        return Ok(new TrackProcessingStatusResponse(t.Id, t.ProcessingStatus, t.HasWaveform, t.Duration));
    }

    [HttpGet("{id}/waveform")]
    public async Task<IActionResult> GetWaveform(Guid id, CancellationToken ct)
    {
        var t = await _context.Tracks
            .Where(t => t.Id == id && t.DeletedAt == null)
            .Select(t => new { t.Id, t.WaveformPeaks, t.Duration, t.LoudnessLufs })
            .FirstOrDefaultAsync(ct);

        if (t is null) return NotFound();
        if (t.WaveformPeaks is null || t.WaveformPeaks.Count == 0)
            return NotFound("Waveform ещё не посчитан — попробуйте позже.");

        return Ok(new WaveformResponse(
            t.Id,
            t.WaveformPeaks,
            t.Duration ?? TimeSpan.Zero,
            t.LoudnessLufs ?? 0));
    }
}