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

        Enum.TryParse<PlaylistVisibility>(request.Visibility, true, out var visibility);

        using var tx = await _context.Database.BeginTransactionAsync();

        var playlist = new Playlist { 
            Id = Guid.NewGuid(), 
            Title = request.Title.Trim(),
            Visibility = visibility
        };

        _context.Playlists.Add(playlist);
        _context.PlaylistMembers.Add(new PlaylistMember
        {
            PlaylistId = playlist.Id,
            UserId = UserId,
            DisplayName = UserName,
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

    // Invitations

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

    // Members

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

    // Tracks

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

    // Queries

    [HttpGet]
    public async Task<IActionResult> GetMyPlaylists()
    {
        var list = await _context.PlaylistMembers
            .Where(pm => pm.UserId == UserId)
            .Include(pm => pm.Playlist)
                .ThenInclude(p => p!.PlaylistTracks)
            .Include(pm => pm.Playlist!.PlaylistMembers)
            .OrderByDescending(pm => pm.JoinedAt)
            .ToListAsync();

        var result = list.Select(pm => {
            var owner = pm.Playlist!.PlaylistMembers.FirstOrDefault(m => m.Role == PlaylistRole.Owner);
            return new
            {
                pm.Playlist!.Id,
                pm.Playlist.Title,
                pm.Playlist.CreatedAt,
                Visibility = pm.Playlist.Visibility.ToString(),
                OwnerName = owner?.DisplayName ?? "Автор",
                TrackCount = pm.Playlist.PlaylistTracks.Count,
                YourRole = pm.Role.ToString()
            };
        });

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPlaylistDetails(Guid id)
    {
        var playlist = await _context.Playlists
            .Include(p => p.PlaylistTracks)
            .ThenInclude(pt => pt.Track)
            .Include(p => p.PlaylistMembers)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (playlist is null) return NotFound();

        var myMember = playlist.PlaylistMembers.FirstOrDefault(pm => pm.UserId == UserId);
        if (myMember is null && playlist.Visibility == PlaylistVisibility.Private)
            return NotFound();

        var owner = playlist.PlaylistMembers.FirstOrDefault(pm => pm.Role == PlaylistRole.Owner);

        return Ok(new
        {
            Id = playlist.Id,
            Title = playlist.Title,
            OwnerId = owner?.UserId ?? Guid.Empty,
            OwnerName = owner?.DisplayName ?? "Автор",
            Visibility = playlist.Visibility.ToString(),
            IsCollaborative = playlist.PlaylistMembers.Any(m => m.Role == PlaylistRole.Editor),
            TrackCount = playlist.PlaylistTracks.Count,
            CreatedAt = playlist.CreatedAt,
            UpdatedAt = playlist.CreatedAt,

            Tracks = playlist.PlaylistTracks
                .OrderBy(pt => pt.AddedAt)
                .Select((pt, i) => new {
                    TrackId = pt.Track!.Id,
                    pt.Track.Title,
                    pt.Track.Artist,
                    pt.Track.Duration,
                    pt.Track.IsExplicit,
                    Position = i + 1,
                    pt.AddedAt,
                    IsLikedByMe = _context.LikedTracks.Any(l => l.TrackId == pt.TrackId && l.UserId == UserId),
                }),
            Members = playlist.PlaylistMembers.Select(m => new {
                m.UserId,
                m.DisplayName,
                Role = m.Role.ToString(),
                m.JoinedAt
            })
        });
    }

    // Visibility / public

    /// <summary>
    /// Смена видимости. Только Owner может менять
    /// </summary>
    [HttpPatch("{playlistId}/visibility")]
    public async Task<IActionResult> SetVisibility(Guid playlistId, [FromBody] SetVisibilityRequest request)
    {
        var playlist = await _context.Playlists.FindAsync(playlistId);
        if (playlist is null) return NotFound();

        if (!await IsCallerInRole(playlistId, PlaylistRole.Owner)) return Forbid();

        if (!Enum.TryParse<PlaylistVisibility>(request.Visibility, ignoreCase: true, out var v))
            return BadRequest($"Неизвестная видимость: {request.Visibility}. Допустимо: Private, Unlisted, Public.");

        if (playlist.Visibility == v) return Ok(new { Visibility = v.ToString() });

        playlist.Visibility = v;
        await _context.SaveChangesAsync();
        return Ok(new { Visibility = v.ToString() });
    }

    /// <summary>
    /// Лента публичных плейлистов
    /// </summary>
    [HttpGet("public")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicPlaylists(
        [FromQuery] int take = 20,
        [FromQuery] DateTime? before = null,
        [FromQuery] string? q = null,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 50);

        var query = _context.Playlists
            .Where(p => p.Visibility == PlaylistVisibility.Public);

        if (before.HasValue)
            query = query.Where(p => p.CreatedAt < before.Value);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var pattern = $"%{q}%";
            query = query.Where(p => EF.Functions.ILike(p.Title, pattern));
        }

        var list = await query
            .OrderByDescending(p => p.CreatedAt)
            .Take(take)
            .Select(p => new
            {
                p.Id,
                p.Title,
                p.CreatedAt,
                TrackCount = p.PlaylistTracks.Count,
                OwnerName = p.PlaylistMembers
                    .Where(m => m.Role == PlaylistRole.Owner)
                    .Select(m => m.DisplayName)
                    .FirstOrDefault() ?? "Автор"
            })
            .ToListAsync(ct);

        return Ok(list);
    }

    private Task<bool> PlaylistExists(Guid id) => _context.Playlists.AnyAsync(p => p.Id == id);

    private Task<bool> IsCallerInRole(Guid playlistId, PlaylistRole role) =>
        _context.PlaylistMembers.AnyAsync(pm =>
            pm.PlaylistId == playlistId && pm.UserId == UserId && pm.Role == role);
}

public class SetVisibilityRequest
{
    /// <summary>
    /// "Private"
    /// или 
    /// "Public"
    /// </summary>
    public required string Visibility { get; set; }
}