using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;

namespace Music.API.Controllers;

[ApiController]
[Route("[controller]")]
public class PlaylistsController : ControllerBase
{
    private readonly AppDbContext _context;

    public PlaylistsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpPost]
    public async Task<IActionResult> CreatePlaylist([FromBody] CreatePlaylistRequest request)
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            return Unauthorized("Пользователь не авторизован");
        }

        var playlist = new Playlist
        {
            Id = Guid.NewGuid(),
            Title = request.Title
        };

        var ownerMember = new PlaylistMember
        {
            PlaylistId = playlist.Id,
            UserId = userId,
            Role = PlaylistRole.Owner
        };

        _context.Playlists.Add(playlist);
        _context.PlaylistMembers.Add(ownerMember);
        await _context.SaveChangesAsync();

        return Ok(new { Message = "Плейлист успешно создан", PlaylistId = playlist.Id });
    }

    [HttpPost("{playlistId}/members")]
    public async Task<IActionResult> AddMember(Guid playlistId, [FromBody] AddPlaylistMemberRequest request)
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var currentUserId))
        {
            return Unauthorized("Пользователь не авторизован");
        }

        var isOwner = await _context.PlaylistMembers
            .AnyAsync(pm => pm.PlaylistId == playlistId &&
                            pm.UserId == currentUserId &&
                            pm.Role == PlaylistRole.Owner);

        if (!isOwner)
        {
            return StatusCode(403, "Только владелец плейлиста может управлять участниками");
        }

        if (!Enum.TryParse<PlaylistRole>(request.Role, true, out var roleToAdd) || roleToAdd == PlaylistRole.Owner)
        {
            return BadRequest("Некорректная роль. Разрешено назначать только: Editor или Viewer.");
        }

        var existingMember = await _context.PlaylistMembers
            .FirstOrDefaultAsync(pm => pm.PlaylistId == playlistId && pm.UserId == request.TargetUserId);

        if (existingMember != null)
        {
            existingMember.Role = roleToAdd;
            await _context.SaveChangesAsync();
            return Ok(new { Message = $"Права участника обновлены на {roleToAdd}" });
        }

        var newMember = new PlaylistMember
        {
            PlaylistId = playlistId,
            UserId = request.TargetUserId,
            Role = roleToAdd
        };

        _context.PlaylistMembers.Add(newMember);
        await _context.SaveChangesAsync();

        return Ok(new { Message = $"Участник успешно добавлен с правами {roleToAdd}" });
    }

    [HttpPost("{playlistId}/tracks/{trackId}")]
    public async Task<IActionResult> AddTrackToPlaylist(Guid playlistId, Guid trackId)
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
            return Unauthorized("Пользователь не авторизован");

        var hasAccess = await _context.PlaylistMembers
            .AnyAsync(pm => pm.PlaylistId == playlistId &&
                            pm.UserId == userId &&
                            (pm.Role == PlaylistRole.Owner || pm.Role == PlaylistRole.Editor));

        if (!hasAccess)
        {
            return StatusCode(403, "У вас нет прав на редактирование этого плейлиста");
        }

        var trackExists = await _context.Tracks.AnyAsync(t => t.Id == trackId);
        if (!trackExists) return NotFound("Трек не найден");

        var alreadyAdded = await _context.PlaylistTracks.AnyAsync(pt => pt.PlaylistId == playlistId && pt.TrackId == trackId);
        if (alreadyAdded) return BadRequest("Этот трек уже есть в данном плейлисте");

        var playlistTrack = new PlaylistTrack
        {
            PlaylistId = playlistId,
            TrackId = trackId
        };

        _context.PlaylistTracks.Add(playlistTrack);
        await _context.SaveChangesAsync();

        return Ok(new { Message = "Трек успешно добавлен в плейлист" });
    }

    [HttpGet]
    public async Task<IActionResult> GetMyPlaylists()
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
            return Unauthorized("Пользователь не авторизован");

        var playlists = await _context.PlaylistMembers
            .Where(pm => pm.UserId == userId)
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

        return Ok(playlists);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetPlaylistDetails(Guid id)
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
            return Unauthorized("Пользователь не авторизован");

        var member = await _context.PlaylistMembers
            .FirstOrDefaultAsync(pm => pm.PlaylistId == id && pm.UserId == userId);

        if (member == null) return StatusCode(403, "Плейлист не найден или у вас нет к нему доступа");

        var playlist = await _context.Playlists
            .Include(p => p.PlaylistTracks)
                .ThenInclude(pt => pt.Track)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (playlist == null) return NotFound("Плейлист не найден");

        var result = new
        {
            playlist.Id,
            playlist.Title,
            playlist.CreatedAt,
            YourRole = member.Role.ToString(),
            Tracks = playlist.PlaylistTracks
                .OrderByDescending(pt => pt.AddedAt)
                .Select(pt => new
                {
                    pt.Track!.Id,
                    pt.Track.Title,
                    pt.Track.Artist,
                    AddedAt = pt.AddedAt
                })
        };

        return Ok(result);
    }
}