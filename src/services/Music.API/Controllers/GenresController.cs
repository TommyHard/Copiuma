using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Models;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class GenresController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly FileStorageService _storage;
    private readonly ModerationService _moderation;

    public GenresController(AppDbContext db, FileStorageService storage, ModerationService moderation)
    {
        _db = db;
        _storage = storage;
        _moderation = moderation;
    }

    private Guid UserId
    {
        get
        {
            var s = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return string.IsNullOrEmpty(s) ? Guid.Empty : Guid.Parse(s);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        // Для каждого жанра сразу подсчитываем сколько у него треков
        var genres = await _db.Genres
            .OrderBy(g => g.DisplayName)
            .Select(g => new
            {
                g.Id,
                g.Slug,
                g.DisplayName,
                TrackCount = _db.TrackGenres.Count(tg => tg.GenreId == g.Id),
            })
            .ToListAsync(ct);
        return Ok(genres);
    }

    /// <summary>
    /// Список треков жанра с пагинацией
    /// /genres/{slug}/tracks?skip=0&amp;take=30
    /// </summary>
    [HttpGet("{slug}/tracks")]
    public async Task<IActionResult> GetTracks(
        string slug,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 30,
        [FromQuery] string sort = "popular",  // popular | new
        CancellationToken ct = default)
    {
        skip = Math.Max(0, skip);
        take = Math.Clamp(take, 1, 100);

        var genre = await _db.Genres
            .Where(g => g.Slug == slug.ToLowerInvariant())
            .Select(g => new { g.Id, g.Slug, g.DisplayName })
            .FirstOrDefaultAsync(ct);
        if (genre is null) return NotFound();

        var me = UserId;

        // фильтр модерации (скрытые/удалённые не показываем)
        var trackIdsInGenre = _db.TrackGenres.Where(tg => tg.GenreId == genre.Id).Select(tg => tg.TrackId);
        IQueryable<Track> baseQuery = _moderation.ApplyVisibilityFilter(_db.Tracks, me)
            .Where(t => trackIdsInGenre.Contains(t.Id));

        if (sort == "new")
        {
            baseQuery = baseQuery.OrderByDescending(t => t.UploadedAt);
        }
        else
        {
            // popular = по числу прослушиваний за 30 дней (с фолбэком на all-time)
            var since = DateTime.UtcNow.AddDays(-30);
            var popularity = _db.PlayEvents
                .Where(e => e.StartedAt >= since)
                .GroupBy(e => e.TrackId)
                .Select(g => new { TrackId = g.Key, Plays = g.Count() });

            baseQuery = baseQuery
                .GroupJoin(popularity, t => t.Id, p => p.TrackId, (t, ps) => new { t, Plays = ps.Sum(x => (int?)x.Plays) ?? 0 })
                .OrderByDescending(x => x.Plays)
                .ThenByDescending(x => x.t.UploadedAt)
                .Select(x => x.t);
        }

        var total = await baseQuery.CountAsync(ct);

        var rows = await baseQuery
            .Skip(skip).Take(take)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Artist,
                t.ArtistId,
                t.AlbumId,
                t.Duration,
                t.UploadedAt,
                t.IsExplicit,
                t.TrackNumber,
                CoverKey = t.CoverKey ?? (t.Album != null ? t.Album.CoverKey : null),
                IsLikedByMe = _db.LikedTracks.Any(l => l.TrackId == t.Id && l.UserId == me),
                FeaturedArtists = _db.TrackFeaturedArtists
                    .Where(fa => fa.TrackId == t.Id)
                    .OrderBy(fa => fa.Position)
                    .Select(fa => new { fa.Artist!.Id, fa.Artist!.Name })
                    .ToList()
            })
            .ToListAsync(ct);

        var items = new List<object>(rows.Count);
        foreach (var r in rows)
        {
            var coverUrl = r.CoverKey is null
                ? null
                : await _storage.GeneratePresignedImageGetUrlAsync(r.CoverKey);
            items.Add(new
            {
                Id = r.Id,
                r.Title,
                r.Artist,
                r.ArtistId,
                r.AlbumId,
                r.Duration,
                r.UploadedAt,
                r.IsExplicit,
                r.TrackNumber,
                CoverUrl = coverUrl,
                r.IsLikedByMe,
                r.FeaturedArtists,
            });
        }

        return Ok(new
        {
            Genre = new { genre.Id, genre.Slug, genre.DisplayName },
            Total = total,
            Items = items,
        });
    }

    /// <summary>
    /// Создать жанр
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Create([FromBody] CreateGenreRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.DisplayName))
            return BadRequest("DisplayName обязателен.");

        var slug = request.Slug?.Trim().ToLowerInvariant()
                   ?? request.DisplayName.Trim().ToLowerInvariant().Replace(' ', '-');

        if (await _db.Genres.AnyAsync(g => g.Slug == slug, ct))
            return Conflict($"Жанр '{slug}' уже существует.");

        var genre = new Genre
        {
            Id = Guid.NewGuid(),
            Slug = slug,
            DisplayName = request.DisplayName.Trim(),
        };

        _db.Genres.Add(genre);
        await _db.SaveChangesAsync(ct);

        return Ok(new { genre.Id, genre.Slug, genre.DisplayName });
    }
}

public class CreateGenreRequest
{
    public string? Slug { get; set; }
    public required string DisplayName { get; set; }
}