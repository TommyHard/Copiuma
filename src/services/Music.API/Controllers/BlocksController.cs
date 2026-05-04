using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Models;
using Music.API.Services;
using System.Security.Claims;
using System.Text.Json;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class BlocksController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly RecommendationsService _rec;

    public BlocksController(AppDbContext db, RecommendationsService rec)
    {
        _db = db;
        _rec = rec;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost("artists/{artistId:guid}")]
    public async Task<IActionResult> BlockArtist(Guid artistId, CancellationToken ct)
    {
        if (!await _db.Artists.AnyAsync(a => a.Id == artistId, ct))
            return NotFound("Артист не найден.");

        var alreadyBlocked = await _db.UserBlockedArtists
            .AnyAsync(b => b.UserId == UserId && b.ArtistId == artistId, ct);

        if (alreadyBlocked) return Ok();

        using var tx = await _db.Database.BeginTransactionAsync(ct);

        // Добавляем блок
        _db.UserBlockedArtists.Add(new UserBlockedArtist
        {
            UserId = UserId,
            ArtistId = artistId
        });

        // Удаляем подписку, если была
        await _db.Follows
            .Where(f => f.FollowerUserId == UserId && f.TargetType == FollowTargetType.Artist && f.TargetId == artistId)
            .ExecuteDeleteAsync(ct);

        var unreadNotifications = await _db.Notifications
            .Where(n => n.UserId == UserId && !n.IsRead)
            .ToListAsync(ct);

        var notificationsToDelete = unreadNotifications.Where(n =>
        {
            try
            {
                var doc = JsonDocument.Parse(n.Payload);
                if (doc.RootElement.TryGetProperty("artistId", out var aIdElem) && aIdElem.TryGetGuid(out var aId))
                    return aId == artistId;
                if (doc.RootElement.TryGetProperty("followerUserId", out var fIdElem) && fIdElem.TryGetGuid(out var fId))
                    return fId == artistId;
            }
            catch { /* ignore */ }
            return false;
        }).ToList();

        if (notificationsToDelete.Any())
        {
            _db.Notifications.RemoveRange(notificationsToDelete);
        }

        await _db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        await _rec.BumpUserVersionAsync(UserId, ct);

        return Ok(new { IsBlocked = true });
    }

    [HttpDelete("artists/{artistId:guid}")]
    public async Task<IActionResult> UnblockArtist(Guid artistId, CancellationToken ct)
    {
        var block = await _db.UserBlockedArtists
            .FirstOrDefaultAsync(b => b.UserId == UserId && b.ArtistId == artistId, ct);

        if (block is null) return Ok();

        _db.UserBlockedArtists.Remove(block);
        await _db.SaveChangesAsync(ct);

        await _rec.BumpUserVersionAsync(UserId, ct);

        return Ok(new { IsBlocked = false });
    }
}