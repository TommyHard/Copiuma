using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using System.Security.Claims;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class PlaylistsController : ControllerBase
{
    private readonly AppDbContext _context;

    public PlaylistsController(AppDbContext context)
    {
        _context = context;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost]
    public async Task<IActionResult> CreatePlaylist([FromBody] CreatePlaylistRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
            return BadRequest("Название плейлиста обязательно.");

        using var tx = await _context.Database.BeginTransactionAsync();

        var playlist = new Playlist { Id = Guid.NewGuid(), Title = request.Title.Trim() };
        var owner = new PlaylistMember
        {
            PlaylistId = playlist.Id,
            UserId = UserId,
            Role = PlaylistRole.Owner
        };

        _context.Playlists.Add(playlist);
        _context.PlaylistMembers.Add(owner);
        await _context.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new { Message = "Плейлист создан.", PlaylistId = playlist.Id });
    }

    [HttpDelete("{playlistId}")]
    public async Task<IActionResult> DeletePlaylist(Guid playlistId)
    {
        var playlist = await _context.Playlists.FindAsync(playlistId);
        if (playlist is null) return NotFound();

        var isOwner = await _context.PlaylistMembers
            .AnyAsync(pm => pm.PlaylistId == playlistId && pm.UserId == UserId && pm.Role == PlaylistRole.Owner);
        if (!isOwner) return Forbid();

        _context.Playlists.Remove(playlist);
        await _context.SaveChangesAsync();
        return Ok(new { Message = "Плейлист удалён." });
    }

    [HttpPost("{playlistId}/members")]
    public async Task<IActionResult> AddMember(Guid playlistId, [FromBody] AddPlaylistMemberRequest request)
    {
        if (!await PlaylistExists(playlistId)) return NotFound();

        var isOwner = await IsCallerInRole(playlistId, PlaylistRole.Owner);
        if (!isOwner) return Forbid();

        if (!Enum.TryParse<PlaylistRole>(request.Role, true, out var role) || role == PlaylistRole.Owner)
            return BadRequest("Допустимые роли: Editor, Viewer.");

        var existing = await _context.PlaylistMembers
            .FirstOrDefaultAsync(pm => pm.PlaylistId == playlistId && pm.UserId == request.TargetUserId);

        if (existing is not null)
        {
            existing.Role = role;
            await _context.SaveChangesAsync();
            return Ok(new { Message = $"Роль обновлена: {role}." });
        }

        _context.PlaylistMembers.Add(new PlaylistMember
        {
            PlaylistId = playlistId,
            UserId = request.TargetUserId,
            Role = role
        });
        await _context.SaveChangesAsync();
        return Ok(new { Message = $"Участник добавлен с ролью {role}." });
    }

    [HttpDelete("{playlistId}/members/{userId}")]
    public async Task<IActionResult> RemoveMember(Guid playlistId, Guid userId)
    {
        if (!await PlaylistExists(playlistId)) return NotFound();

        var isOwner = await IsCallerInRole(playlistId, PlaylistRole.Owner);
        if (!isOwner) return Forbid();

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

        if (member is null)
        {
            return NotFound();
        }

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
