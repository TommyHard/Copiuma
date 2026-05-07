using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class ArtistsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly FileStorageService _storage;
    private readonly ModerationService _moderation;

    public ArtistsController(AppDbContext db, FileStorageService storage, ModerationService moderation)
    {
        _db = db;
        _storage = storage;
        _moderation = moderation;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>
    /// Возвращает первого артиста, созданного текущим пользователем (его "профиль артиста")
    /// </summary>
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine()
    {
        var artist = await _db.Artists
            .Where(a => a.CreatedByUserId == UserId)
            .OrderBy(a => a.CreatedAt)
            .FirstOrDefaultAsync();

        if (artist is null) return NoContent();
        return Ok(await BuildResponse(artist.Id));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateArtistRequest request)
    {
        var name = (request.Name ?? string.Empty).Trim();
        if (name.Length == 0) return BadRequest("Имя артиста обязательно.");
        if (name.Length > 200) return BadRequest("Имя артиста: максимум 200 символов.");

        if (await _db.Artists.AnyAsync(a => a.Name.ToLower() == name.ToLower()))
            return Conflict("Артист с таким именем уже есть.");

        var artist = new Artist
        {
            Id = Guid.NewGuid(),
            Name = name,
            Bio = request.Bio?.Trim(),
            CreatedByUserId = UserId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Artists.Add(artist);
        await _db.SaveChangesAsync();

        return Ok(await BuildResponse(artist.Id));
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string? q = null,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 20)
    {
        skip = Math.Max(0, skip);
        take = Math.Clamp(take, 1, 100);

        IQueryable<Artist> query = _db.Artists;

        // Исключаем заблокированных артистов
        query = query.Where(a => !_db.UserBlockedArtists.Any(b => b.UserId == UserId && b.ArtistId == a.Id));

        if (!string.IsNullOrWhiteSpace(q))
        {
            query = query.Where(a => a.SearchVector!
                .Matches(EF.Functions.WebSearchToTsQuery("russian", q)));
        }

        var total = await query.CountAsync();

        var page = await query
            .OrderBy(a => a.Name)
            .Skip(skip).Take(take)
            .Select(a => new
            {
                a.Id,
                a.Name,
                a.AvatarKey,
                AlbumCount = _db.Albums.Count(al => al.ArtistId == a.Id),
                TrackCount = _db.Tracks.Count(t => t.ArtistId == a.Id)
            })
            .ToListAsync();

        var items = new List<ArtistListItem>(page.Count);
        foreach (var a in page)
        {
            var avatarUrl = a.AvatarKey is null
                ? null
                : await _storage.GeneratePresignedImageGetUrlAsync(a.AvatarKey);
            items.Add(new ArtistListItem(a.Id, a.Name, avatarUrl, a.AlbumCount, a.TrackCount));
        }

        return Ok(new { total, items });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var resp = await BuildResponse(id);
        return resp is null ? NotFound() : Ok(resp);
    }

    [HttpGet("{id:guid}/albums")]
    public async Task<IActionResult> Albums(Guid id)
    {
        if (!await _db.Artists.AnyAsync(a => a.Id == id)) return NotFound();

        var rows = await _db.Albums
            .Where(al => al.ArtistId == id)
            .OrderByDescending(al => al.ReleaseDate ?? DateOnly.MinValue)
            .ThenBy(al => al.Title)
            .Select(al => new
            {
                al.Id,
                al.Title,
                al.ArtistId,
                ArtistName = al.Artist!.Name,
                al.CoverKey,
                al.ReleaseDate,
                al.Genres,
                TrackCount = _db.Tracks.Count(t => t.AlbumId == al.Id)
            })
            .ToListAsync();

        var list = new List<AlbumListItem>(rows.Count);
        foreach (var r in rows)
        {
            var url = r.CoverKey is null
                ? null
                : await _storage.GeneratePresignedImageGetUrlAsync(r.CoverKey);
            list.Add(new AlbumListItem(r.Id, r.Title, r.ArtistId, r.ArtistName,
                url, r.ReleaseDate, r.Genres ?? new List<string>(), r.TrackCount));
        }

        return Ok(list);
    }

    [HttpGet("{id:guid}/tracks")]
    public async Task<IActionResult> Tracks(Guid id)
    {
        if (!await _db.Artists.AnyAsync(a => a.Id == id)) return NotFound();

        var me = UserId;

        var query = _moderation.ApplyVisibilityFilter(_db.Tracks, me, hideDislikes: false, hideBlocked: false)
            .Where(t => t.ArtistId == id);

        var rows = await query
            .OrderByDescending(t => t.UploadedAt)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Artist,
                t.ArtistId,
                t.Duration,
                t.AlbumId,
                t.TrackNumber,
                t.UploadedAt,
                t.IsExplicit,
                CoverKey = t.CoverKey ?? t.Album!.CoverKey,
                IsLikedByMe = _db.LikedTracks.Any(l => l.TrackId == t.Id && l.UserId == me),
                IsDislikedByMe = _db.UserDislikes.Any(d => d.TargetType == DislikeTargetType.Track && d.TargetId == t.Id && d.UserId == me),
                FeaturedArtists = _db.TrackFeaturedArtists
                    .Where(fa => fa.TrackId == t.Id)
                    .OrderBy(fa => fa.Position)
                    .Select(fa => new { fa.Artist!.Id, fa.Artist.Name })
                    .ToList()
            })
            .ToListAsync();

        var tracks = new List<object>(rows.Count);
        foreach (var r in rows)
        {
            var coverUrl = r.CoverKey is null
                ? null
                : await _storage.GeneratePresignedImageGetUrlAsync(r.CoverKey);

            tracks.Add(new
            {
                r.Id,
                r.Title,
                r.Artist,
                r.ArtistId,
                r.Duration,
                r.AlbumId,
                r.TrackNumber,
                r.UploadedAt,
                r.IsExplicit,
                CoverUrl = coverUrl,
                r.IsLikedByMe,
                r.IsDislikedByMe,
                r.FeaturedArtists
            });
        }

        return Ok(tracks);
    }

    [HttpGet("{id:guid}/featured-on")]
    public async Task<IActionResult> FeaturedOn(Guid id)
    {
        if (!await _db.Artists.AnyAsync(a => a.Id == id)) return NotFound();

        var me = UserId;

        var query = _moderation.ApplyVisibilityFilter(_db.Tracks, me, hideDislikes: false, hideBlocked: false)
            .Where(t => t.ArtistId != id && _db.TrackFeaturedArtists.Any(fa => fa.TrackId == t.Id && fa.ArtistId == id));

        var tracks = await query
            .OrderByDescending(t => t.UploadedAt)
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Artist,
                t.ArtistId,
                t.Duration,
                t.AlbumId,
                t.TrackNumber,
                t.UploadedAt,
                t.IsExplicit,
                IsLikedByMe = _db.LikedTracks.Any(l => l.TrackId == t.Id && l.UserId == me),
                IsDislikedByMe = _db.UserDislikes.Any(d => d.TargetType == DislikeTargetType.Track && d.TargetId == t.Id && d.UserId == me),
                FeaturedArtists = _db.TrackFeaturedArtists
                    .Where(fa => fa.TrackId == t.Id)
                    .OrderBy(fa => fa.Position)
                    .Select(fa => new { fa.Artist!.Id, fa.Artist.Name })
                    .ToList()
            })
            .ToListAsync();

        return Ok(tracks);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateArtistRequest request)
    {
        var artist = await _db.Artists.FindAsync(id);
        if (artist is null) return NotFound();
        if (artist.CreatedByUserId != UserId) return Forbid();

        if (request.Name is not null)
        {
            var name = request.Name.Trim();
            if (name.Length == 0 || name.Length > 200)
                return BadRequest("Некорректное имя.");
            artist.Name = name;
        }

        if (request.Bio is not null)
            artist.Bio = request.Bio.Trim();

        artist.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var affected = await _db.Tracks
            .Where(t => t.ArtistId == id)
            .ExecuteUpdateAsync(u => u.SetProperty(t => t.Artist, artist.Name));

        return Ok(await BuildResponse(id));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var artist = await _db.Artists.FindAsync(id);
        if (artist is null) return NotFound();
        if (artist.CreatedByUserId != UserId) return Forbid();

        if (await _db.Albums.AnyAsync(al => al.ArtistId == id))
            return Conflict("У артиста есть альбомы — удалите их сначала.");

        if (await _db.Tracks.AnyAsync(t => t.ArtistId == id))
            return Conflict("У артиста есть треки — открепите их сначала.");

        if (artist.AvatarKey is not null)
        {
            try { await _storage.DeleteImageAsync(artist.AvatarKey); } catch { }
        }

        _db.Artists.Remove(artist);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/avatar")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> UploadAvatar(Guid id, IFormFile file)
    {
        if (file is null || file.Length == 0) return BadRequest("Файл пуст.");
        if (!FileStorageService.IsAllowedImageContentType(file.ContentType))
            return BadRequest($"Недопустимый content-type: {file.ContentType}.");

        var artist = await _db.Artists.FindAsync(id);
        if (artist is null) return NotFound();
        if (artist.CreatedByUserId != UserId) return Forbid();

        await using var stream = file.OpenReadStream();
        var key = await _storage.UploadImageAsync(
            stream, file.FileName, file.ContentType, file.Length, $"artists/{id}");

        var oldKey = artist.AvatarKey;
        artist.AvatarKey = key;
        artist.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        if (oldKey is not null)
        {
            try { await _storage.DeleteImageAsync(oldKey); } catch { }
        }

        return Ok(await BuildResponse(id));
    }

    [HttpDelete("{id:guid}/avatar")]
    public async Task<IActionResult> DeleteAvatar(Guid id)
    {
        var artist = await _db.Artists.FindAsync(id);
        if (artist is null) return NotFound();
        if (artist.CreatedByUserId != UserId) return Forbid();
        if (artist.AvatarKey is null) return NoContent();

        try { await _storage.DeleteImageAsync(artist.AvatarKey); } catch { }
        artist.AvatarKey = null;
        artist.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/banner")]
    [RequestSizeLimit(15_000_000)]
    public async Task<IActionResult> UploadBanner(Guid id, IFormFile file)
    {
        if (file is null || file.Length == 0) return BadRequest("Файл пуст.");
        if (!FileStorageService.IsAllowedImageContentType(file.ContentType))
            return BadRequest($"Недопустимый content-type: {file.ContentType}.");

        var artist = await _db.Artists.FindAsync(id);
        if (artist is null) return NotFound();
        if (artist.CreatedByUserId != UserId) return Forbid();

        await using var stream = file.OpenReadStream();
        var key = await _storage.UploadImageAsync(
            stream, file.FileName, file.ContentType, file.Length, $"artists/{id}/banner");

        var oldKey = artist.BannerKey;
        artist.BannerKey = key;
        artist.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        if (oldKey is not null)
        {
            try { await _storage.DeleteImageAsync(oldKey); } catch { }
        }

        return Ok(await BuildResponse(id));
    }

    [HttpDelete("{id:guid}/banner")]
    public async Task<IActionResult> DeleteBanner(Guid id)
    {
        var artist = await _db.Artists.FindAsync(id);
        if (artist is null) return NotFound();
        if (artist.CreatedByUserId != UserId) return Forbid();
        if (artist.BannerKey is null) return NoContent();

        try { await _storage.DeleteImageAsync(artist.BannerKey); } catch { }
        artist.BannerKey = null;
        artist.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(await BuildResponse(id));
    }

    private async Task<ArtistResponse?> BuildResponse(Guid id)
    {
        var row = await _db.Artists
            .Where(a => a.Id == id)
            .Select(a => new
            {
                a.Id,
                a.Name,
                a.Bio,
                a.AvatarKey,
                a.BannerKey,
                a.CreatedByUserId,
                a.CreatedAt,
                AlbumCount = _db.Albums.Count(al => al.ArtistId == a.Id),
                TrackCount = _db.Tracks.Count(t => t.ArtistId == a.Id),
                Followers = _db.Follows.Count(f => f.TargetType == Models.FollowTargetType.Artist && f.TargetId == a.Id),
                IsBlockedByMe = _db.UserBlockedArtists.Any(b => b.UserId == UserId && b.ArtistId == a.Id)
            })
            .FirstOrDefaultAsync();

        if (row is null) return null;

        var avatarUrl = row.AvatarKey is null
            ? null
            : await _storage.GeneratePresignedImageGetUrlAsync(row.AvatarKey);

        var bannerUrl = row.BannerKey is null
            ? null
            : await _storage.GeneratePresignedImageGetUrlAsync(row.BannerKey);

        var since30 = DateTime.UtcNow.AddDays(-30);
        var monthlyListeners = await _db.PlayEvents
            .Where(pe => pe.Track!.ArtistId == id && pe.StartedAt >= since30)
            .Select(pe => pe.UserId)
            .Distinct()
            .CountAsync();

        return new ArtistResponse(
            row.Id, row.Name, row.Bio, avatarUrl, bannerUrl,
            row.CreatedByUserId, row.CreatedAt,
            row.AlbumCount, row.TrackCount,
            row.Followers, monthlyListeners,
            row.IsBlockedByMe);
    }
}