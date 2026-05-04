using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Controllers;

/// <summary>
/// "Недавно прослушанное" - экран History
/// </summary>
[ApiController]
[Authorize]
[Route("[controller]")]
public class HistoryController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ModerationService _mod;

    public HistoryController(AppDbContext db, ModerationService mod)
    {
        _db = db;
        _mod = mod;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>
    /// Последние уникальные прослушанные треки
    /// </summary>
    /// <param name="take">Сколько строк (1-100, по умолчанию 50)</param>
    /// <param name="sinceDays">Окно истории в днях (1-365, по умолчанию 30)</param>
    [HttpGet("tracks")]
    public async Task<IActionResult> GetTrackHistory(
        [FromQuery] int take = 50,
        [FromQuery] int sinceDays = 30,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 100);
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
            .Take(take)
            .ToListAsync(ct);

        if (aggregated.Count == 0)
            return Ok(Array.Empty<HistoryTrackItem>());

        var trackIds = aggregated.Select(x => x.TrackId).ToList();
        var tracks = await _mod.ApplyVisibilityFilter(_db.Tracks, UserId)
            .Where(t => trackIds.Contains(t.Id))
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Artist,
                t.ArtistId,
                t.AlbumId,
                t.Duration
            })
            .ToDictionaryAsync(x => x.Id, ct);

        var result = aggregated
            .Where(a => tracks.ContainsKey(a.TrackId))
            .Select(a =>
            {
                var t = tracks[a.TrackId];
                return new HistoryTrackItem(
                    a.TrackId,
                    t.Title,
                    t.Artist,
                    t.ArtistId,
                    t.AlbumId,
                    t.Duration,
                    a.LastPlayedAt,
                    a.PlayCount);
            })
            .ToList();

        return Ok(result);
    }

    /// <summary>
    /// Лента прослушиваний — без дедупликации
    /// </summary>
    [HttpGet("tracks/raw")]
    public async Task<IActionResult> GetRawHistory(
        [FromQuery] int take = 100,
        [FromQuery] int sinceDays = 30,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 500);
        sinceDays = Math.Clamp(sinceDays, 1, 365);
        var since = DateTime.UtcNow.AddDays(-sinceDays);

        var visibleTracks = _mod.ApplyVisibilityFilter(_db.Tracks, UserId);

        var events = await _db.PlayEvents
            .Where(p => p.UserId == UserId && p.StartedAt >= since)
            .Where(p => visibleTracks.Any(t => t.Id == p.TrackId))
            .OrderByDescending(p => p.StartedAt)
            .Take(take)
            .Select(p => new
            {
                p.TrackId,
                p.StartedAt,
                p.PlayedMs,
                p.Completed,
                p.Source,
                Title = p.Track!.Title,
                Artist = p.Track!.Artist,
                Duration = p.Track!.Duration
            })
            .ToListAsync(ct);

        return Ok(events);
    }

    /// <summary>
    /// Топ артистов пользователя за окно.
    /// Score — число прослушиваний треков этого артиста
    /// </summary>
    [HttpGet("artists")]
    public async Task<IActionResult> GetTopArtists(
        [FromQuery] int take = 20,
        [FromQuery] int sinceDays = 30,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 100);
        sinceDays = Math.Clamp(sinceDays, 1, 365);
        var since = DateTime.UtcNow.AddDays(-sinceDays);

        var aggregated = await _db.PlayEvents
            .Where(p => p.UserId == UserId && p.StartedAt >= since && p.Track!.ArtistId != null)
            .Where(p => !_db.UserBlockedArtists.Any(b => b.UserId == UserId && b.ArtistId == p.Track!.ArtistId))
            .GroupBy(p => p.Track!.ArtistId!.Value)
            .Select(g => new
            {
                ArtistId = g.Key,
                PlayCount = g.Count(),
                LastPlayedAt = g.Max(x => x.StartedAt)
            })
            .OrderByDescending(x => x.PlayCount)
            .ThenByDescending(x => x.LastPlayedAt)
            .Take(take)
            .ToListAsync(ct);

        if (aggregated.Count == 0)
            return Ok(Array.Empty<TopArtistItem>());

        var ids = aggregated.Select(x => x.ArtistId).ToList();
        var artists = await _db.Artists
            .Where(a => ids.Contains(a.Id))
            .Select(a => new { a.Id, a.Name, a.AvatarKey })
            .ToDictionaryAsync(x => x.Id, ct);

        var result = aggregated
            .Where(a => artists.ContainsKey(a.ArtistId))
            .Select(a =>
            {
                var meta = artists[a.ArtistId];
                return new TopArtistItem(
                    a.ArtistId,
                    meta.Name,
                    meta.AvatarKey,
                    a.PlayCount,
                    a.LastPlayedAt);
            })
            .ToList();

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