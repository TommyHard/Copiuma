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
public class PlaylistsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly NotificationService _notify;

    public PlaylistsController(AppDbContext context, NotificationService notify)
    {
        _context = context;
        _notify = notify;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string? UserName => User.FindFirstValue("DisplayName");

    [HttpPost]
    public async Task<IActionResult> CreatePlaylist([FromBody] CreatePlaylistRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest("Название плейлиста обязательно.");

        using var tx = await _context.Database.BeginTransactionAsync();

        var playlist = new Playlist { Id = Guid.NewGuid(), Title = request.Title.Trim() };
        _context.Playlists.Add(playlist);
        _context.PlaylistMembers.Add(new PlaylistMember
        {
            PlaylistId = playlist.Id,
            UserId = UserId,
            Role = PlaylistRole.Owner
        });

        await _context.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new { Message = "Плейлист создан.", PlaylistId = playlist.Id });
    }

    [HttpDelete("{playlistId}")]
    public async Task<IActionResult> DeletePlaylist(Guid playlistId)
    {
        var playlist = await _context.Playlists.FindAsync(playlistId);
        if (playlist is null) return NotFound();

        if (!await IsCallerInRole(playlistId, PlaylistRole.Owner)) return Forbid();

        _context.Playlists.Remove(playlist);
        await _context.SaveChangesAsync();
        return Ok();
    }

    // ---------- Invitations ----------

    [HttpPost("{playlistId}/invite")]
    public async Task<IActionResult> Invite(Guid playlistId, [FromBody] InviteToPlaylistRequest request)
    {
        var playlist = await _context.Playlists.FindAsync(playlistId);
        if (playlist is null) return NotFound();

        if (!await IsCallerInRole(playlistId, PlaylistRole.Owner)) return Forbid();

        if (!Enum.TryParse<PlaylistRole>(request.Role, true, out var role) || role == PlaylistRole.Owner)
            return BadRequest("Допустимые роли: Editor, Viewer.");

        if (request.InviteeId == UserId)
            return BadRequest("Нельзя пригласить самого себя.");

        if (await _context.PlaylistMembers.AnyAsync(m => m.PlaylistId == playlistId && m.UserId == request.InviteeId))
            return Conflict("Пользователь уже участник плейлиста.");

        if (await _context.PlaylistInvitations.AnyAsync(i =>
            i.PlaylistId == playlistId &&
            i.InviteeId == request.InviteeId &&
            i.Status == InvitationStatus.Pending))
        {
            return Conflict("Приглашение уже отправлено и ожидает ответа.");
        }

        var invitation = new PlaylistInvitation
        {
            Id = Guid.NewGuid(),
            PlaylistId = playlistId,
            InviterId = UserId,
            InviteeId = request.InviteeId,
            ProposedRole = role,
            Status = InvitationStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        _context.PlaylistInvitations.Add(invitation);
        await _context.SaveChangesAsync();

        await _notify.CreateAsync(request.InviteeId, NotificationTypes.PlaylistInvitation, new
        {
            invitationId = invitation.Id,
            playlistId,
            playlistTitle = playlist.Title,
            inviterId = UserId,
            inviterName = UserName,
            proposedRole = role.ToString()
        });

        return Ok(new { Message = "Приглашение отправлено.", invitation.Id });
    }

    [HttpGet("{playlistId}/invitations")]
    public async Task<IActionResult> ListInvitations(Guid playlistId)
    {
        if (!await IsCallerInRole(playlistId, PlaylistRole.Owner)) return Forbid();

        var list = await _context.PlaylistInvitations
            .Where(i => i.PlaylistId == playlistId)
            .OrderByDescending(i => i.CreatedAt)
            .Select(i => new
            {
                i.Id,
                i.InviteeId,
                Role = i.ProposedRole.ToString(),
                Status = i.Status.ToString(),
                i.CreatedAt,
                i.RespondedAt
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpDelete("{playlistId}/invitations/{invitationId}")]
    public async Task<IActionResult> CancelInvitation(Guid playlistId, Guid invitationId)
    {
        if (!await IsCallerInRole(playlistId, PlaylistRole.Owner)) return Forbid();

        var inv = await _context.PlaylistInvitations
            .FirstOrDefaultAsync(i => i.Id == invitationId && i.PlaylistId == playlistId);
        if (inv is null) return NotFound();

        if (inv.Status != InvitationStatus.Pending)
            return Conflict("Приглашение уже обработано — отозвать нельзя.");

        inv.Status = InvitationStatus.Cancelled;
        inv.RespondedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // ---------- Members ----------

    [HttpDelete("{playlistId}/members/{userId}")]
    public async Task<IActionResult> RemoveMember(Guid playlistId, Guid userId)
    {
        if (!await PlaylistExists(playlistId)) return NotFound();
        if (!await IsCallerInRole(playlistId, PlaylistRole.Owner)) return Forbid();

        if (userId == UserId)
            return BadRequest("Владелец не может удалить сам себя. Используйте удаление плейлиста.");

        var m = await _context.PlaylistMembers
            .FirstOrDefaultAsync(pm => pm.PlaylistId == playlistId && pm.UserId == userId);
        if (m is null) return NotFound();

        _context.PlaylistMembers.Remove(m);
        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("{playlistId}/leave")]
    public async Task<IActionResult> Leave(Guid playlistId)
    {
        var m = await _context.PlaylistMembers
            .FirstOrDefaultAsync(pm => pm.PlaylistId == playlistId && pm.UserId == UserId);
        if (m is null) return NotFound();

        if (m.Role == PlaylistRole.Owner)
            return BadRequest("Владельцу нельзя покинуть плейлист — передайте владение или удалите плейлист.");

        _context.PlaylistMembers.Remove(m);
        await _context.SaveChangesAsync();
        return Ok();
    }

    // ---------- Tracks ----------

    [HttpPost("{playlistId}/tracks/{trackId}")]
    public async Task<IActionResult> AddTrackToPlaylist(Guid playlistId, Guid trackId)
    {
        if (!await PlaylistExists(playlistId)) return NotFound();

        var canEdit = await _context.PlaylistMembers.AnyAsync(pm =>
            pm.PlaylistId == playlistId && pm.UserId == UserId &&
            (pm.Role == PlaylistRole.Owner || pm.Role == PlaylistRole.Editor));
        if (!canEdit) return Forbid();

        if (!await _context.Tracks.AnyAsync(t => t.Id == trackId))
            return NotFound("Трек не найден.");

        if (await _context.PlaylistTracks.AnyAsync(pt => pt.PlaylistId == playlistId && pt.TrackId == trackId))
            return BadRequest("Трек уже в плейлисте.");

        _context.PlaylistTracks.Add(new PlaylistTrack { PlaylistId = playlistId, TrackId = trackId });
        await _context.SaveChangesAsync();
        return Ok();
    }

    [HttpDelete("{playlistId}/tracks/{trackId}")]
    public async Task<IActionResult> RemoveTrackFromPlaylist(Guid playlistId, Guid trackId)
    {
        if (!await PlaylistExists(playlistId)) return NotFound();

        var canEdit = await _context.PlaylistMembers.AnyAsync(pm =>
            pm.PlaylistId == playlistId && pm.UserId == UserId &&
            (pm.Role == PlaylistRole.Owner || pm.Role == PlaylistRole.Editor));
        if (!canEdit) return Forbid();

        var link = await _context.PlaylistTracks
            .FirstOrDefaultAsync(pt => pt.PlaylistId == playlistId && pt.TrackId == trackId);
        if (link is null) return NotFound();

        _context.PlaylistTracks.Remove(link);
        await _context.SaveChangesAsync();
        return Ok();
    }

    // ---------- Queries ----------

    [HttpGet]
    public async Task<IActionResult> GetMyPlaylists()
    {
        var list = await _context.PlaylistMembers
            .Where(pm => pm.UserId == UserId)
            .Include(pm => pm.Playlist)
            .OrderByDescending(pm => pm.JoinedAt)
            .Select(pm => new
            {
                pm.Playlist!.Id,
                pm.Playlist.Title,
                pm.Playlist.CreatedAt,
                YourRole = pm.Role.ToString()
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPlaylistDetails(Guid id)
    {
        var member = await _context.PlaylistMembers
            .FirstOrDefaultAsync(pm => pm.PlaylistId == id && pm.UserId == UserId);
        if (member is null) return NotFound();

        var playlist = await _context.Playlists
            .Include(p => p.PlaylistTracks)
                .ThenInclude(pt => pt.Track)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (playlist is null) return NotFound();

        return Ok(new
        {
            playlist.Id,
            playlist.Title,
            playlist.CreatedAt,
            YourRole = member.Role.ToString(),
            Tracks = playlist.PlaylistTracks
                .OrderByDescending(pt => pt.AddedAt)
                .Select(pt => new { pt.Track!.Id, pt.Track.Title, pt.Track.Artist, pt.AddedAt })
        });
    }

    private Task<bool> PlaylistExists(Guid id) => _context.Playlists.AnyAsync(p => p.Id == id);

    private Task<bool> IsCallerInRole(Guid playlistId, PlaylistRole role) =>
        _context.PlaylistMembers.AnyAsync(pm =>
            pm.PlaylistId == playlistId && pm.UserId == UserId && pm.Role == role);
}
