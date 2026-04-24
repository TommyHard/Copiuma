using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using System.Text.Json;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class ChangelogController : ControllerBase
{
    private static readonly HashSet<string> AllowedEntityTypes =
        new(StringComparer.Ordinal)
        {
            "Playlist", "Track", "Artist", "Album", "PlaylistInvitation"
        };

    private readonly AppDbContext _db;

    public ChangelogController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet("{entityType}/{entityId:guid}")]
    public async Task<IActionResult> ForEntity(
        string entityType,
        Guid entityId,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50)
    {
        if (!AllowedEntityTypes.Contains(entityType))
            return BadRequest($"Неизвестный тип сущности: {entityType}.");

        skip = Math.Max(0, skip);
        take = Math.Clamp(take, 1, 200);

        var total = await _db.ChangeLogEntries
            .CountAsync(c => c.EntityType == entityType && c.EntityId == entityId);

        var rows = await _db.ChangeLogEntries
            .Where(c => c.EntityType == entityType && c.EntityId == entityId)
            .OrderByDescending(c => c.CreatedAt)
            .Skip(skip).Take(take)
            .Select(c => new
            {
                c.Id,
                c.Kind,
                c.ActorUserId,
                c.CreatedAt,
                c.Changes
            })
            .ToListAsync();

        var items = rows.Select(r => new
        {
            r.Id,
            kind = r.Kind.ToString(),
            r.ActorUserId,
            r.CreatedAt,
            changes = JsonSerializer.Deserialize<JsonElement>(r.Changes)
        });

        return Ok(new { total, items });
    }
}