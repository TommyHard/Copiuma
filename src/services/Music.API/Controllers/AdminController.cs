using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using System.Security.Claims;

namespace Music.API.Controllers;

/// <summary>
/// Админ действия: shadowban, mute, DMCA-takedown, set-explicit
///
///   POST   /admin/users/{id}/shadowban        — забанить пользователя в ленте
///   DELETE /admin/users/{id}/shadowban        — снять
///   POST   /admin/users/{id}/mute             — лишить права создавать ревью/жалобы
///   DELETE /admin/users/{id}/mute
///   POST   /admin/tracks/{id}/takedown        — DMCA removal (soft-delete + причина)
///   POST   /admin/tracks/{id}/remove          — обычное admin-удаление (soft)
///   PATCH  /admin/tracks/{id}/explicit        — выставить/снять флаг explicit
/// </summary>
[ApiController]
[Authorize(Roles = "Admin")]
[Route("admin")]
public class AdminController : ControllerBase
{
    private readonly AppDbContext _db;

    public AdminController(AppDbContext db)
    {
        _db = db;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // ---- User flags ----

    [HttpPost("users/{userId:guid}/shadowban")]
    public Task<IActionResult> Shadowban(Guid userId, [FromBody] ShadowbanRequest request, CancellationToken ct)
        => UpsertFlag(userId, UserFlagKind.Shadowbanned, request.Note, request.ExpiresAt, ct);

    [HttpDelete("users/{userId:guid}/shadowban")]
    public Task<IActionResult> RemoveShadowban(Guid userId, CancellationToken ct)
        => RemoveFlag(userId, UserFlagKind.Shadowbanned, ct);

    [HttpPost("users/{userId:guid}/mute")]
    public Task<IActionResult> Mute(Guid userId, [FromBody] ShadowbanRequest request, CancellationToken ct)
        => UpsertFlag(userId, UserFlagKind.Muted, request.Note, request.ExpiresAt, ct);

    [HttpDelete("users/{userId:guid}/mute")]
    public Task<IActionResult> RemoveMute(Guid userId, CancellationToken ct)
        => RemoveFlag(userId, UserFlagKind.Muted, ct);

    private async Task<IActionResult> UpsertFlag(
        Guid userId, UserFlagKind kind, string? note, DateTime? expiresAt, CancellationToken ct)
    {
        if (userId == UserId) return BadRequest("Нельзя применять флаг к самому себе.");
        if (expiresAt is DateTime ex && ex < DateTime.UtcNow)
            return BadRequest("ExpiresAt должен быть в будущем.");

        var existing = await _db.UserFlags
            .FirstOrDefaultAsync(f => f.UserId == userId && f.Kind == kind, ct);

        if (existing is null)
        {
            _db.UserFlags.Add(new UserFlag
            {
                UserId = userId,
                Kind = kind,
                SetByUserId = UserId,
                SetAt = DateTime.UtcNow,
                Note = note?.Trim(),
                ExpiresAt = expiresAt
            });
        }
        else
        {
            existing.SetByUserId = UserId;
            existing.SetAt = DateTime.UtcNow;
            existing.Note = note?.Trim();
            existing.ExpiresAt = expiresAt;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { userId, kind, expiresAt });
    }

    private async Task<IActionResult> RemoveFlag(Guid userId, UserFlagKind kind, CancellationToken ct)
    {
        var affected = await _db.UserFlags
            .Where(f => f.UserId == userId && f.Kind == kind)
            .ExecuteDeleteAsync(ct);
        return Ok(new { userId, kind, Removed = affected > 0 });
    }

    // ---- Track admin actions ----

    [HttpPost("tracks/{trackId:guid}/takedown")]
    public async Task<IActionResult> DmcaTakedown(
        Guid trackId, [FromBody] DmcaTakedownRequest request, CancellationToken ct)
    {
        var track = await _db.Tracks.FindAsync(new object?[] { trackId }, ct);
        if (track is null) return NotFound();
        if (track.DeletedAt != null) return Conflict("Трек уже удалён.");

        track.DeletedAt = DateTime.UtcNow;
        track.DeletionReason = TrackDeletionReason.DmcaTakedown;


        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            trackId,
            deletedAt = track.DeletedAt,
            reason = track.DeletionReason,
            request.ClaimantEmail,
            request.ClaimReference
        });
    }

    [HttpPost("tracks/{trackId:guid}/remove")]
    public async Task<IActionResult> ModeratorRemove(Guid trackId, CancellationToken ct)
    {
        var track = await _db.Tracks.FindAsync(new object?[] { trackId }, ct);
        if (track is null) return NotFound();
        if (track.DeletedAt != null) return Conflict("Трек уже удалён.");

        track.DeletedAt = DateTime.UtcNow;
        track.DeletionReason = TrackDeletionReason.ModeratorRemoved;
        await _db.SaveChangesAsync(ct);

        return Ok(new { trackId, deletedAt = track.DeletedAt });
    }

    [HttpPatch("tracks/{trackId:guid}/explicit")]
    public async Task<IActionResult> SetExplicit(
        Guid trackId, [FromBody] SetExplicitRequest request, CancellationToken ct)
    {
        var track = await _db.Tracks.FindAsync(new object?[] { trackId }, ct);
        if (track is null) return NotFound();

        track.IsExplicit = request.IsExplicit;
        await _db.SaveChangesAsync(ct);

        return Ok(new { trackId, track.IsExplicit });
    }
}