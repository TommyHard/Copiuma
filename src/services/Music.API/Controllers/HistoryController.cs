using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class HistoryController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ModerationService _mod;
    private readonly FileStorageService _storage;

    public HistoryController(AppDbContext db, ModerationService mod, FileStorageService storage)
    {
        _db = db;
        _mod = mod;
        _storage = storage;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("tracks")]
    public async Task<IActionResult> GetTrackHistory(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        [FromQuery] int sinceDays = 30,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        limit = Math.Clamp(limit, 1, 100);
        sinceDays = Math.Clamp(sinceDays, 1, 365);
        var since = DateTime.UtcNow.AddDays(-sinceDays);

        var aggregated = await _db.PlayEvents
            .Where(p => p.UserId == UserId && p.StartedAt >= since)
            .GroupBy(p => p.TrackId)
            .Select(g => new
            {
                TrackId = g.Key,
                LastPlayedAt = g.Max(x => x.StartedAt),
                PlayCount = g.Count()
            })
            .OrderByDescending(x => x.LastPlayedAt)
            .Skip((page - 1) * limit)
            .Take(limit)
            .ToListAsync(ct);

        if (aggregated.Count == 0) return Ok(Array.Empty<HistoryTrackItem>());

        var trackIds = aggregated.Select(x => x.TrackId).ToList();

        var tracksData = await _mod.ApplyVisibilityFilter(_db.Tracks, UserId)
            .Where(t => trackIds.Contains(t.Id))
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Artist,
                t.ArtistId,
                t.AlbumId,
                t.Duration,
                t.CoverKey,
                AlbumCoverKey = t.Album != null ? t.Album.CoverKey : null,
                IsLikedByMe = _db.LikedTracks.Any(l => l.TrackId == t.Id && l.UserId == UserId),
                FeaturedArtists = _db.TrackFeaturedArtists
                    .Where(fa => fa.TrackId == t.Id)
                    .OrderBy(fa => fa.Position)
                    .Select(fa => new HistoryFeaturedArtist(fa.Artist!.Id, fa.Artist.Name))
                    .ToList()
            })
            .ToDictionaryAsync(x => x.Id, ct);

        var result = new List<HistoryTrackItem>();
        foreach (var a in aggregated)
        {
            if (tracksData.TryGetValue(a.TrackId, out var t))
            {
                var key = t.CoverKey ?? t.AlbumCoverKey;
                var coverUrl = key != null ? await _storage.GeneratePresignedImageGetUrlAsync(key) : null;

                result.Add(new HistoryTrackItem(
                    a.TrackId, t.Title, t.Artist, t.ArtistId, t.AlbumId, t.Duration,
                    a.LastPlayedAt, a.PlayCount, coverUrl, t.FeaturedArtists, t.IsLikedByMe));
            }
        }

        return Ok(result);
    }

    [HttpGet("tracks/raw")]
    public async Task<IActionResult> GetRawHistory(
        [FromQuery] int page = 1,
        [FromQuery] int limit = 20,
        [FromQuery] int sinceDays = 30,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        limit = Math.Clamp(limit, 1, 100);
        sinceDays = Math.Clamp(sinceDays, 1, 365);
        var since = DateTime.UtcNow.AddDays(-sinceDays);

        var latestPlays = await _db.PlayEvents
            .Where(p => p.UserId == UserId && p.StartedAt >= since)
            .Where(p => p.StartedAt == _db.PlayEvents
                .Where(sub => sub.UserId == UserId && sub.TrackId == p.TrackId)
                .Max(sub => sub.StartedAt))
            .OrderByDescending(p => p.StartedAt)
            .Skip((page - 1) * limit)
            .Take(limit)
            .Select(p => new
            {
                p.TrackId,
                p.StartedAt,
                p.PlayedMs,
                p.Completed,
                p.Source
            })
            .ToListAsync(ct);

        if (latestPlays.Count == 0) return Ok(Array.Empty<object>());

        var trackIds = latestPlays.Select(p => p.TrackId).Distinct().ToList();

        var tracksInfo = await _mod.ApplyVisibilityFilter(_db.Tracks, UserId)
            .Where(t => trackIds.Contains(t.Id))
            .Select(t => new {
                t.Id,
                t.Title,
                t.Artist,
                t.Duration,
                IsLikedByMe = _db.LikedTracks.Any(l => l.TrackId == t.Id && l.UserId == UserId),
                FeaturedArtists = _db.TrackFeaturedArtists
                    .Where(fa => fa.TrackId == t.Id)
                    .OrderBy(fa => fa.Position)
                    .Select(fa => new { fa.Artist!.Id, fa.Artist.Name })
                    .ToList()
            })
            .ToDictionaryAsync(x => x.Id, ct);

        var result = latestPlays
            .Where(p => tracksInfo.ContainsKey(p.TrackId))
            .Select(p =>
            {
                var t = tracksInfo[p.TrackId];
                return new
                {
                    p.TrackId,
                    p.StartedAt,
                    p.PlayedMs,
                    p.Completed,
                    p.Source,
                    Title = t.Title,
                    Artist = t.Artist,
                    Duration = t.Duration,
                    IsLikedByMe = t.IsLikedByMe,
                    FeaturedArtists = t.FeaturedArtists
                };
            });

        return Ok(result);
    }

    [HttpGet("artists")]
    public async Task<IActionResult> GetTopArtists(
        [FromQuery] int limit = 30,
        CancellationToken ct = default)
    {
        limit = Math.Clamp(limit, 1, 100);
        var since = DateTime.UtcNow.AddDays(-30);

        var aggregated = await _db.PlayEvents
            .Where(p => p.UserId == UserId && p.StartedAt >= since && p.Track!.ArtistId != null)
            .Where(p => !_db.UserBlockedArtists.Any(b => b.UserId == UserId && b.ArtistId == p.Track!.ArtistId))
            .GroupBy(p => p.Track!.ArtistId!.Value)
            .Select(g => new { ArtistId = g.Key, PlayCount = g.Count(), LastPlayedAt = g.Max(x => x.StartedAt) })
            .OrderByDescending(x => x.PlayCount)
            .Take(limit)
            .ToListAsync(ct);

        var ids = aggregated.Select(x => x.ArtistId).ToList();
        var artists = await _db.Artists.Where(a => ids.Contains(a.Id)).ToDictionaryAsync(x => x.Id, ct);

        var result = new List<TopArtistItem>();
        foreach (var a in aggregated)
        {
            if (artists.TryGetValue(a.ArtistId, out var meta))
            {
                var avatarUrl = meta.AvatarKey != null ? await _storage.GeneratePresignedImageGetUrlAsync(meta.AvatarKey) : null;
                result.Add(new TopArtistItem(a.ArtistId, meta.Name, avatarUrl, a.PlayCount, a.LastPlayedAt));
            }
        }
        return Ok(result);
    }

    /// <summary>
    /// Удалить свою историю
    /// </summary>
    [HttpDelete]
    public async Task<IActionResult> ClearMyHistory(CancellationToken ct)
    {
        var affected = await _db.PlayEvents
            .Where(p => p.UserId == UserId)
            .ExecuteDeleteAsync(ct);
        return Ok(new { Removed = affected });
    }
}