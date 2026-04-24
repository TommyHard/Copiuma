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
    public async Task<IActionResult> List()
    {
        var items = await _db.UserDislikes
            .Where(d => d.UserId == UserId)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new
            {
                targetType = d.TargetType.ToString(),
                d.TargetId,
                d.CreatedAt
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("tracks/{trackId:guid}")]
    public Task<IActionResult> DislikeTrack(Guid trackId) =>
        AddAsync(DislikeTargetType.Track, trackId);

    [HttpDelete("tracks/{trackId:guid}")]
    public Task<IActionResult> UndoTrack(Guid trackId) =>
        RemoveAsync(DislikeTargetType.Track, trackId);

    [HttpPost("artists/{artistId:guid}")]
    public Task<IActionResult> DislikeArtist(Guid artistId) =>
        AddAsync(DislikeTargetType.Artist, artistId);

    [HttpDelete("artists/{artistId:guid}")]
    public Task<IActionResult> UndoArtist(Guid artistId) =>
        RemoveAsync(DislikeTargetType.Artist, artistId);

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

        await _rec.BumpVersionAsync();

        return NoContent();
    }

    private async Task<IActionResult> RemoveAsync(DislikeTargetType type, Guid targetId)
    {
        var row = await _db.UserDislikes
            .FirstOrDefaultAsync(d => d.UserId == UserId && d.TargetType == type && d.TargetId == targetId);
        if (row is null) return NotFound();

        _db.UserDislikes.Remove(row);
        await _db.SaveChangesAsync();

        await _rec.BumpVersionAsync();

        return NoContent();
    }
}