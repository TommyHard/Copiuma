using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Models;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Controllers;

/// <summary>
/// Mute трека или артиста для персональных рекомендаций
/// </summary>
[ApiController]
[Authorize]
[Route("[controller]")]
public class DislikesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly RecommendationsService _rec;

    public DislikesController(AppDbContext db, RecommendationsService rec)
    {
        _db = db;
        _rec = rec;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var dislikes = await _db.UserDislikes
            .Where(d => d.UserId == UserId)
            .OrderByDescending(d => d.CreatedAt)
            .ToListAsync(ct);

        var trackIds = dislikes.Where(d => d.TargetType == DislikeTargetType.Track).Select(d => d.TargetId).ToList();
        var artistIds = dislikes.Where(d => d.TargetType == DislikeTargetType.Artist).Select(d => d.TargetId).ToList();

        var tracks = await _db.Tracks.Where(t => trackIds.Contains(t.Id))
            .Select(t => new { t.Id, t.Title, t.Artist, t.ArtistId })
            .ToDictionaryAsync(t => t.Id, ct);

        var artists = await _db.Artists.Where(a => artistIds.Contains(a.Id))
            .Select(a => new { a.Id, a.Name })
            .ToDictionaryAsync(a => a.Id, ct);

        var items = dislikes.Select(d =>
        {
            var isTrack = d.TargetType == DislikeTargetType.Track;
            tracks.TryGetValue(d.TargetId, out var t);
            artists.TryGetValue(d.TargetId, out var a);

            return new
            {
                targetType = d.TargetType.ToString(),
                targetId = d.TargetId,
                Title = isTrack ? t?.Title : a?.Name ?? "Удалено",
                ArtistName = isTrack ? t?.Artist : null,
                ArtistId = isTrack ? t?.ArtistId : null,
                d.CreatedAt
            };
        });

        return Ok(items);
    }

    [HttpPost("tracks/{trackId:guid}")]
    public Task<IActionResult> DislikeTrack(Guid trackId) => AddAsync(DislikeTargetType.Track, trackId);

    [HttpDelete("tracks/{trackId:guid}")]
    public Task<IActionResult> UndoTrack(Guid trackId) => RemoveAsync(DislikeTargetType.Track, trackId);

    [HttpPost("artists/{artistId:guid}")]
    public Task<IActionResult> DislikeArtist(Guid artistId) => AddAsync(DislikeTargetType.Artist, artistId);

    [HttpDelete("artists/{artistId:guid}")]
    public Task<IActionResult> UndoArtist(Guid artistId) => RemoveAsync(DislikeTargetType.Artist, artistId);

    private async Task<IActionResult> AddAsync(DislikeTargetType type, Guid targetId)
    {
        var exists = type switch
        {
            DislikeTargetType.Track => await _db.Tracks.AnyAsync(t => t.Id == targetId),
            DislikeTargetType.Artist => await _db.Artists.AnyAsync(a => a.Id == targetId),
            _ => false
        };
        if (!exists) return NotFound();

        var already = await _db.UserDislikes
            .AnyAsync(d => d.UserId == UserId && d.TargetType == type && d.TargetId == targetId);
        if (already) return Conflict("Уже в дизлайках.");

        _db.UserDislikes.Add(new UserDislike
        {
            UserId = UserId,
            TargetType = type,
            TargetId = targetId,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();

        await _rec.BumpUserVersionAsync(UserId);

        return NoContent();
    }

    private async Task<IActionResult> RemoveAsync(DislikeTargetType type, Guid targetId)
    {
        var row = await _db.UserDislikes
            .FirstOrDefaultAsync(d => d.UserId == UserId && d.TargetType == type && d.TargetId == targetId);
        if (row is null) return NotFound();

        _db.UserDislikes.Remove(row);
        await _db.SaveChangesAsync();

        await _rec.BumpUserVersionAsync(UserId);

        return NoContent();
    }
}