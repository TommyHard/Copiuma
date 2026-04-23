using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class InvitationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly NotificationService _notify;

    public InvitationsController(AppDbContext db, NotificationService notify)
    {
        _db = db;
        _notify = notify;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string? UserName => User.FindFirstValue("DisplayName");

    [HttpGet]
    public async Task<IActionResult> Mine([FromQuery] bool pendingOnly = true)
    {
        IQueryable<PlaylistInvitation> q = _db.PlaylistInvitations
            .Include(i => i.Playlist)
            .Where(i => i.InviteeId == UserId);

        if (pendingOnly)
            q = q.Where(i => i.Status == InvitationStatus.Pending);

        var items = await q
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new InvitationResponse(
                i.Id,
                i.PlaylistId,
                i.Playlist!.Title,
                i.InviterId,
                null,
                i.ProposedRole.ToString(),
                i.Status.ToString(),
                i.CreatedAt))
            .ToListAsync();

        return Ok(items);
    }

    [HttpPost("{id}/accept")]
    public async Task<IActionResult> Accept(Guid id)
    {
        using var tx = await _db.Database.BeginTransactionAsync();

        var inv = await _db.PlaylistInvitations
            .Include(x => x.Playlist)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (inv is null) return NotFound();
        if (inv.InviteeId != UserId) return Forbid();
        if (inv.Status != InvitationStatus.Pending) return Conflict("Приглашение уже обработано.");

        var already = await _db.PlaylistMembers
            .AnyAsync(m => m.PlaylistId == inv.PlaylistId && m.UserId == UserId);

        if (!already)
        {
            _db.PlaylistMembers.Add(new PlaylistMember
            {
                PlaylistId = inv.PlaylistId,
                UserId = UserId,
                Role = inv.ProposedRole
            });
        }

        inv.Status = InvitationStatus.Accepted;
        inv.RespondedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        await _notify.CreateAsync(inv.InviterId, NotificationTypes.PlaylistInvitationAccepted, new
        {
            invitationId = inv.Id,
            playlistId = inv.PlaylistId,
            playlistTitle = inv.Playlist!.Title,
            inviteeId = UserId,
            inviteeName = UserName
        });

        return Ok(new { Message = "Приглашение принято.", inv.PlaylistId });
    }

    [HttpPost("{id}/decline")]
    public async Task<IActionResult> Decline(Guid id)
    {
        var inv = await _db.PlaylistInvitations
            .Include(x => x.Playlist)
            .FirstOrDefaultAsync(x => x.Id == id);

        if (inv is null) return NotFound();
        if (inv.InviteeId != UserId) return Forbid();
        if (inv.Status != InvitationStatus.Pending) return Conflict("Приглашение уже обработано.");

        inv.Status = InvitationStatus.Declined;
        inv.RespondedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await _notify.CreateAsync(inv.InviterId, NotificationTypes.PlaylistInvitationDeclined, new
        {
            invitationId = inv.Id,
            playlistId = inv.PlaylistId,
            playlistTitle = inv.Playlist!.Title,
            inviteeId = UserId,
            inviteeName = UserName
        });

        return NoContent();
    }
}