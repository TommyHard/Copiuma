using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Controllers;

/// <summary>
/// CRUD + поиск по альбомам, обложка в bucket "images", attach/detach треков
/// Удалить альбом можно только если он пуст (все треки откреплены)
/// </summary>
[ApiController]
[Authorize]
[Route("[controller]")]
public class AlbumsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly FileStorageService _storage;
    private readonly FollowFanoutService _fanout;

    public AlbumsController(AppDbContext db, FileStorageService storage, FollowFanoutService fanout)
    {
        _db = db;
        _storage = storage;
        _fanout = fanout;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateAlbumRequest request)
    {
        var title = (request.Title ?? string.Empty).Trim();
        if (title.Length == 0) return BadRequest("Название альбома обязательно.");
        if (title.Length > 200) return BadRequest("Название альбома: максимум 200 символов.");

        var artist = await _db.Artists.FindAsync(request.ArtistId);
        if (artist is null) return BadRequest("Артист не найден.");

        if (await _db.Albums.AnyAsync(a => a.ArtistId == request.ArtistId &&
                                           a.Title.ToLower() == title.ToLower()))
            return Conflict("У этого артиста уже есть альбом с таким названием.");

        var album = new Album
        {
            Id = Guid.NewGuid(),
            Title = title,
            ArtistId = request.ArtistId,
            ReleaseDate = request.ReleaseDate,
            Genres = TracksController.NormalizeGenres(request.Genres),
            CreatedByUserId = UserId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Albums.Add(album);
        await _db.SaveChangesAsync();

        await _fanout.FanOutNewAlbumAsync(artist.Id, album.Id, album.Title, artist.Name);

        return Ok(await BuildResponse(album.Id));
    }

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] Guid? artistId = null,
        [FromQuery] string? q = null,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 20)
    {
        skip = Math.Max(0, skip);
        take = Math.Clamp(take, 1, 100);

        IQueryable<Album> query = _db.Albums;

        if (artistId.HasValue)
            query = query.Where(a => a.ArtistId == artistId.Value);

        if (!string.IsNullOrWhiteSpace(q))
        {
            query = query.Where(a => a.SearchVector!
                .Matches(EF.Functions.WebSearchToTsQuery("russian", q)));
        }

        var total = await query.CountAsync();

        var rows = await query
            .OrderByDescending(a => a.ReleaseDate ?? DateOnly.MinValue)
            .ThenBy(a => a.Title)
            .Skip(skip).Take(take)
            .Select(a => new
            {
                a.Id,
                a.Title,
                a.ArtistId,
                ArtistName = a.Artist!.Name,
                a.CoverKey,
                a.ReleaseDate,
                a.Genres,
                TrackCount = _db.Tracks.Count(t => t.AlbumId == a.Id)
            })
            .ToListAsync();

        var items = new List<AlbumListItem>(rows.Count);
        foreach (var r in rows)
        {
            var url = r.CoverKey is null
                ? null
                : await _storage.GeneratePresignedImageGetUrlAsync(r.CoverKey);
            items.Add(new AlbumListItem(r.Id, r.Title, r.ArtistId, r.ArtistName,
                url, r.ReleaseDate, r.Genres ?? new List<string>(), r.TrackCount));
        }

        return Ok(new { total, items });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        var resp = await BuildResponse(id);
        return resp is null ? NotFound() : Ok(resp);
    }

    [HttpGet("{id:guid}/tracks")]
    public async Task<IActionResult> Tracks(Guid id)
    {
        if (!await _db.Albums.AnyAsync(a => a.Id == id)) return NotFound();

        var items = await _db.Tracks
            .Where(t => t.AlbumId == id)
            .OrderBy(t => t.TrackNumber ?? int.MaxValue)
            .ThenBy(t => t.UploadedAt)
            .Select(t => new AlbumTrackItem(t.Id, t.Title, t.TrackNumber, t.Duration))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateAlbumRequest request)
    {
        var album = await _db.Albums.FindAsync(id);
        if (album is null) return NotFound();
        if (album.CreatedByUserId != UserId) return Forbid();

        if (request.Title is not null)
        {
            var title = request.Title.Trim();
            if (title.Length == 0 || title.Length > 200)
                return BadRequest("Некорректное название.");
            album.Title = title;
        }

        if (request.ReleaseDate.HasValue)
            album.ReleaseDate = request.ReleaseDate;

        if (request.Genres is not null)
            album.Genres = TracksController.NormalizeGenres(request.Genres);

        album.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(await BuildResponse(id));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var album = await _db.Albums.FindAsync(id);
        if (album is null) return NotFound();
        if (album.CreatedByUserId != UserId) return Forbid();

        if (await _db.Tracks.AnyAsync(t => t.AlbumId == id))
            return Conflict("В альбоме есть треки — открепите их сначала.");

        if (album.CoverKey is not null)
        {
            try { await _storage.DeleteImageAsync(album.CoverKey); } catch { }
        }

        _db.Albums.Remove(album);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ---- Cover ----

    [HttpPost("{id:guid}/cover")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> UploadCover(Guid id, IFormFile file)
    {
        if (file is null || file.Length == 0) return BadRequest("Файл пуст.");
        if (!FileStorageService.IsAllowedImageContentType(file.ContentType))
            return BadRequest($"Недопустимый content-type: {file.ContentType}.");

        var album = await _db.Albums.FindAsync(id);
        if (album is null) return NotFound();
        if (album.CreatedByUserId != UserId) return Forbid();

        await using var stream = file.OpenReadStream();
        var key = await _storage.UploadImageAsync(
            stream, file.FileName, file.ContentType, file.Length, $"albums/{id}");

        var oldKey = album.CoverKey;
        album.CoverKey = key;
        album.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        if (oldKey is not null)
        {
            try { await _storage.DeleteImageAsync(oldKey); } catch { }
        }

        var url = await _storage.GeneratePresignedImageGetUrlAsync(key);
        return Ok(new { coverUrl = url });
    }

    [HttpDelete("{id:guid}/cover")]
    public async Task<IActionResult> DeleteCover(Guid id)
    {
        var album = await _db.Albums.FindAsync(id);
        if (album is null) return NotFound();
        if (album.CreatedByUserId != UserId) return Forbid();
        if (album.CoverKey is null) return NoContent();

        try { await _storage.DeleteImageAsync(album.CoverKey); } catch { }
        album.CoverKey = null;
        album.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ---- Attach/detach tracks ----

    /// <summary>
    /// Привязывает существующий трек к альбому. Трек должен принадлежать тому же
    /// артисту, что и альбом (иначе 400). Если трек ранее был в другом альбоме
    /// этого же артиста — перевязываем
    /// </summary>
    [HttpPost("{id:guid}/tracks/{trackId:guid}")]
    public async Task<IActionResult> AttachTrack(
        Guid id, Guid trackId, [FromBody] AttachAlbumTrackRequest? request)
    {
        var album = await _db.Albums.FindAsync(id);
        if (album is null) return NotFound("Альбом не найден.");
        if (album.CreatedByUserId != UserId) return Forbid();

        var track = await _db.Tracks.FindAsync(trackId);
        if (track is null) return NotFound("Трек не найден.");
        if (track.UploadedByUserId != UserId) return Forbid();

        if (track.ArtistId is null)
            return BadRequest("У трека не указан артист — сначала привяжите ArtistId.");
        if (track.ArtistId != album.ArtistId)
            return BadRequest("Трек принадлежит другому артисту.");

        track.AlbumId = id;
        track.TrackNumber = request?.TrackNumber;
        await _db.SaveChangesAsync();

        return Ok(new { trackId, albumId = id, trackNumber = track.TrackNumber });
    }

    [HttpDelete("{id:guid}/tracks/{trackId:guid}")]
    public async Task<IActionResult> DetachTrack(Guid id, Guid trackId)
    {
        var album = await _db.Albums.FindAsync(id);
        if (album is null) return NotFound("Альбом не найден.");
        if (album.CreatedByUserId != UserId) return Forbid();

        var track = await _db.Tracks.FirstOrDefaultAsync(t => t.Id == trackId && t.AlbumId == id);
        if (track is null) return NotFound("Трек не найден в этом альбоме.");

        track.AlbumId = null;
        track.TrackNumber = null;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<AlbumResponse?> BuildResponse(Guid id)
    {
        var row = await _db.Albums
            .Where(a => a.Id == id)
            .Select(a => new
            {
                a.Id,
                a.Title,
                a.ArtistId,
                ArtistName = a.Artist!.Name,
                a.CoverKey,
                a.ReleaseDate,
                a.Genres,
                a.CreatedByUserId,
                a.CreatedAt,
                TrackCount = _db.Tracks.Count(t => t.AlbumId == a.Id)
            })
            .FirstOrDefaultAsync();

        if (row is null) return null;

        var coverUrl = row.CoverKey is null
            ? null
            : await _storage.GeneratePresignedImageGetUrlAsync(row.CoverKey);

        return new AlbumResponse(
            row.Id,
            row.Title,
            row.ArtistId,
            row.ArtistName,
            coverUrl,
            row.ReleaseDate,
            row.Genres ?? new List<string>(),
            row.CreatedByUserId,
            row.CreatedAt,
            row.TrackCount);
    }
}