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
public class OfflineController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly FileStorageService _files;

    /// <summary>
    /// TTL presigned URL'ов для офлайн-пакета
    /// </summary>
    private const int BundleUrlExpirySeconds = 24 * 60 * 60; // 24 часа

    public OfflineController(AppDbContext db, FileStorageService files)
    {
        _db = db;
        _files = files;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ---------- Queries ----------

    [HttpGet]
    public async Task<IActionResult> GetMyOffline(CancellationToken ct)
    {
        var rows = await _db.OfflineItems
            .Where(o => o.UserId == UserId)
            .OrderByDescending(o => o.AddedAt)
            .Select(o => new
            {
                o.TrackId,
                o.Source,
                o.AddedAt,
                o.LastDownloadedAt,
                Title = o.Track!.Title,
                Artist = o.Track!.Artist,
                Duration = o.Track!.Duration,
                ArtistId = o.Track!.ArtistId,
                AlbumId = o.Track!.AlbumId,
                FileKey = o.Track!.FileName
            })
            .ToListAsync(ct);

        return Ok(rows);
    }

    /// <summary>
    /// "Пачка для скачивания": список + presigned URL на каждый трек с TTL 24ч
    /// Клиент вызывает, когда реально собирается качать (а не просто открыл список)
    /// Отдельный эндпойнт, чтобы не генерировать доступ на каждое открытие экрана
    /// </summary>
    [HttpGet("bundle")]
    public async Task<IActionResult> GetBundle(CancellationToken ct)
    {
        var rows = await _db.OfflineItems
            .Where(o => o.UserId == UserId)
            .OrderByDescending(o => o.AddedAt)
            .Select(o => new
            {
                o.TrackId,
                o.Source,
                o.AddedAt,
                o.LastDownloadedAt,
                Title = o.Track!.Title,
                Artist = o.Track!.Artist,
                Duration = o.Track!.Duration,
                FileKey = o.Track!.FileName
            })
            .ToListAsync(ct);

        var bundle = new List<object>(rows.Count);
        foreach (var r in rows)
        {
            if (string.IsNullOrEmpty(r.FileKey))
            {
                bundle.Add(new
                {
                    r.TrackId,
                    r.Source,
                    r.Title,
                    r.Artist,
                    r.Duration,
                    r.AddedAt,
                    r.LastDownloadedAt,
                    Url = (string?)null,
                    UrlExpiresAt = (DateTime?)null
                });
                continue;
            }

            var url = await _files.GeneratePresignedGetUrlAsync(r.FileKey, BundleUrlExpirySeconds);
            bundle.Add(new
            {
                r.TrackId,
                r.Source,
                r.Title,
                r.Artist,
                r.Duration,
                r.AddedAt,
                r.LastDownloadedAt,
                Url = url,
                UrlExpiresAt = DateTime.UtcNow.AddSeconds(BundleUrlExpirySeconds)
            });
        }

        return Ok(bundle);
    }

    // ---------- Single track ----------

    [HttpPost("tracks/{trackId:guid}")]
    public async Task<IActionResult> AddTrack(Guid trackId, CancellationToken ct)
    {
        if (!await _db.Tracks.AnyAsync(t => t.Id == trackId, ct))
            return NotFound("Трек не найден.");

        return await UpsertAsync(trackId, "single", ct);
    }

    [HttpDelete("tracks/{trackId:guid}")]
    public async Task<IActionResult> RemoveTrack(Guid trackId, CancellationToken ct)
    {
        var affected = await _db.OfflineItems
            .Where(o => o.UserId == UserId && o.TrackId == trackId)
            .ExecuteDeleteAsync(ct);

        return affected > 0 ? Ok() : NotFound();
    }

    [HttpPost("tracks/{trackId:guid}/downloaded")]
    public async Task<IActionResult> MarkDownloaded(Guid trackId, CancellationToken ct)
    {
        var affected = await _db.OfflineItems
            .Where(o => o.UserId == UserId && o.TrackId == trackId)
            .ExecuteUpdateAsync(u => u.SetProperty(o => o.LastDownloadedAt, DateTime.UtcNow), ct);

        return affected > 0 ? Ok() : NotFound();
    }

    // ---------- Bulk by playlist ----------

    [HttpPost("playlists/{playlistId:guid}")]
    public async Task<IActionResult> AddFromPlaylist(Guid playlistId, CancellationToken ct)
    {
        var isMember = await _db.PlaylistMembers
            .AnyAsync(pm => pm.PlaylistId == playlistId && pm.UserId == UserId, ct);
        if (!isMember) return Forbid();

        var trackIds = await _db.PlaylistTracks
            .Where(pt => pt.PlaylistId == playlistId)
            .Select(pt => pt.TrackId)
            .ToListAsync(ct);

        if (trackIds.Count == 0) return Ok(new { Added = 0 });

        var added = await BulkUpsertAsync(trackIds, $"playlist:{playlistId}", ct);
        return Ok(new { Added = added, Total = trackIds.Count });
    }

    /// <summary>
    /// "Убрать офлайн-пакет плейлиста N" — удаляем только те закладки,
    /// которые были добавлены именно через этот плейлист (Source совпадает)
    /// Треки, которые юзер дополнительно пометил как single - останутся
    /// </summary>
    [HttpDelete("playlists/{playlistId:guid}")]
    public async Task<IActionResult> RemoveFromPlaylist(Guid playlistId, CancellationToken ct)
    {
        var src = $"playlist:{playlistId}";
        var affected = await _db.OfflineItems
            .Where(o => o.UserId == UserId && o.Source == src)
            .ExecuteDeleteAsync(ct);
        return Ok(new { Removed = affected });
    }

    // ---------- Bulk by album ----------

    [HttpPost("albums/{albumId:guid}")]
    public async Task<IActionResult> AddFromAlbum(Guid albumId, CancellationToken ct)
    {
        if (!await _db.Albums.AnyAsync(a => a.Id == albumId, ct))
            return NotFound("Альбом не найден.");

        var trackIds = await _db.Tracks
            .Where(t => t.AlbumId == albumId)
            .Select(t => t.Id)
            .ToListAsync(ct);

        if (trackIds.Count == 0) return Ok(new { Added = 0 });

        var added = await BulkUpsertAsync(trackIds, $"album:{albumId}", ct);
        return Ok(new { Added = added, Total = trackIds.Count });
    }

    [HttpDelete("albums/{albumId:guid}")]
    public async Task<IActionResult> RemoveFromAlbum(Guid albumId, CancellationToken ct)
    {
        var src = $"album:{albumId}";
        var affected = await _db.OfflineItems
            .Where(o => o.UserId == UserId && o.Source == src)
            .ExecuteDeleteAsync(ct);
        return Ok(new { Removed = affected });
    }

    // ---------- Internals ----------

    private async Task<IActionResult> UpsertAsync(Guid trackId, string source, CancellationToken ct)
    {
        var existing = await _db.OfflineItems
            .FirstOrDefaultAsync(o => o.UserId == UserId && o.TrackId == trackId, ct);

        if (existing is null)
        {
            _db.OfflineItems.Add(new OfflineItem
            {
                UserId = UserId,
                TrackId = trackId,
                Source = source,
                AddedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync(ct);
            return Ok(new { Added = true });
        }

        if (existing.Source != source)
        {
            existing.Source = source;
            await _db.SaveChangesAsync(ct);
        }
        return Ok(new { Added = false });
    }

    /// <summary>
    /// Массовый upsert для add-from-playlist / add-from-album
    /// Чтобы не делать N запросов, сначала вычитываем уже существующие TrackId
    /// одним SELECTом, потом SELECT-после-INSERT не нужен
    /// Возвращаем число НОВЫХ добавлений (уже существующие закладки не трогаем —
    /// не переопределяем Source, чтобы не воровать трек у другого плейлиста)
    /// </summary>
    private async Task<int> BulkUpsertAsync(IReadOnlyCollection<Guid> trackIds, string source, CancellationToken ct)
    {
        var existingIds = await _db.OfflineItems
            .Where(o => o.UserId == UserId && trackIds.Contains(o.TrackId))
            .Select(o => o.TrackId)
            .ToListAsync(ct);

        var existingSet = existingIds.ToHashSet();
        var now = DateTime.UtcNow;

        var toInsert = trackIds
            .Where(id => !existingSet.Contains(id))
            .Select(id => new OfflineItem
            {
                UserId = UserId,
                TrackId = id,
                Source = source,
                AddedAt = now
            })
            .ToList();

        if (toInsert.Count == 0) return 0;

        _db.OfflineItems.AddRange(toInsert);
        await _db.SaveChangesAsync(ct);
        return toInsert.Count;
    }
}