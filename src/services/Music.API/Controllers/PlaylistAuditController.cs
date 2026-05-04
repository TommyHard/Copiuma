using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using System.Security.Claims;

namespace Music.API.Controllers;

[ApiController]
[Route("playlists/{id}/audit")]
[Authorize]
public class PlaylistAuditController : ControllerBase
{
    private readonly AppDbContext _db;

    public PlaylistAuditController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PlaylistAudit>>> GetAuditLog(
            [FromRoute] Guid id,
            [FromQuery] int skip = 0,
            [FromQuery] int take = 8,
            CancellationToken ct = default)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdStr, out var userId))
            return Unauthorized();

        var playlist = await _db.Playlists
            .Include(p => p.PlaylistMembers)
            .FirstOrDefaultAsync(p => p.Id == id, ct);

        if (playlist == null)
            return NotFound();

        var member = playlist.PlaylistMembers.FirstOrDefault(m => m.UserId == userId);
        if (member == null)
        {
            return Forbid("Только участники плейлиста могут просматривать аудит изменений.");
        }

        var logs = await _db.ChangeLogEntries
            .Where(e => e.EntityId == id &&
                        (e.EntityType == "Playlist" || e.EntityType == "PlaylistTrack" || e.EntityType == "PlaylistMember"))
            .OrderByDescending(e => e.CreatedAt)
            .Skip(skip)
            .Take(take)
            .Select(e => new PlaylistAudit(
                e.Id,
                e.EntityType,
                (int)e.Kind,
                e.ActorUserId,
                e.Changes,
                e.CreatedAt,
                null
            ))
            .ToListAsync(ct);

        var trackIds = new HashSet<Guid>();
        foreach (var log in logs.Where(l => l.EntityType == "PlaylistTrack"))
        {
            try
            {
                var doc = System.Text.Json.JsonDocument.Parse(log.Changes);
                if (doc.RootElement.TryGetProperty("TrackId", out var trackIdEl) && trackIdEl.TryGetGuid(out var trackId))
                {
                    trackIds.Add(trackId);
                }
            }
            catch { /* ignore */ }
        }

        if (trackIds.Any())
        {
            var tracks = await _db.Tracks
                .Where(t => trackIds.Contains(t.Id))
                .Select(t => new { t.Id, t.Title })
                .ToDictionaryAsync(t => t.Id, t => t.Title, ct);

            for (int i = 0; i < logs.Count; i++)
            {
                if (logs[i].EntityType == "PlaylistTrack")
                {
                    try
                    {
                        var doc = System.Text.Json.JsonDocument.Parse(logs[i].Changes);
                        if (doc.RootElement.TryGetProperty("TrackId", out var trackIdEl) && trackIdEl.TryGetGuid(out var trackId))
                        {
                            if (tracks.TryGetValue(trackId, out var title))
                            {
                                logs[i] = logs[i] with { TrackTitle = title };
                            }
                        }
                    }
                    catch { }
                }
            }
        }

        return Ok(logs);
    }
}