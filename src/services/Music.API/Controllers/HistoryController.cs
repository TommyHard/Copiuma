using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
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

    public HistoryController(AppDbContext db)
    {
        _db = db;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>
    /// Последние уникальные прослушанные треки.
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
        var tracks = await _db.Tracks
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
    /// Лента прослушиваний без дедупликации
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

        var events = await _db.PlayEvents
            .Where(p => p.UserId == UserId && p.StartedAt >= since)
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
    /// Лента прослушиваний с дедупликацией
    /// </summary>
    //[HttpGet("tracks/raw")]
    //public async Task<IActionResult> GetRawHistory(
    //[FromQuery] int take = 100,
    //[FromQuery] int sinceDays = 30,
    //CancellationToken ct = default)
    //{
    //    take = Math.Clamp(take, 1, 500);
    //    sinceDays = Math.Clamp(sinceDays, 1, 365);
    //    var since = DateTime.UtcNow.AddDays(-sinceDays);

    //    var grouped = await _db.PlayEvents
    //        .Where(p => p.UserId == UserId && p.StartedAt >= since)
    //        .GroupBy(p => p.TrackId)
    //        .Select(g => new
    //        {
    //            TrackId = g.Key,
    //            LatestStartedAt = g.Max(p => p.StartedAt),
    //            PlayCount = g.Count()
    //        })
    //        .OrderByDescending(x => x.LatestStartedAt)
    //        .Take(take)
    //        .ToListAsync(ct);

    //    if (!grouped.Any())
    //        return Ok(Array.Empty<object>());

    //    var latestEvents = await _db.PlayEvents
    //        .Where(p => p.UserId == UserId)
    //        .Join(grouped,
    //            p => new { p.TrackId, p.StartedAt },
    //            g => new { g.TrackId, StartedAt = g.LatestStartedAt },
    //            (p, g) => new
    //            {
    //                p.TrackId,
    //                p.StartedAt,
    //                p.PlayedMs,
    //                p.Completed,
    //                p.Source,
    //                Title = p.Track!.Title,
    //                Artist = p.Track!.Artist,
    //                Duration = p.Track!.Duration,
    //                g.PlayCount
    //            })
    //        .ToListAsync(ct);

    //    return Ok(latestEvents);
    //}

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