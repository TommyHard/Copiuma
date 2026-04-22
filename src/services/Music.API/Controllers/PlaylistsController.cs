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
            Title = request.Title,
            UserId = userId
        };

        _context.Playlists.Add(playlist);
        await _context.SaveChangesAsync();

        return Ok(new { Message = "Плейлист успешно создан", PlaylistId = playlist.Id });
    }

    [HttpPost("{playlistId}/tracks/{trackId}")]
    public async Task<IActionResult> AddTrackToPlaylist(Guid playlistId, Guid trackId)
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            return Unauthorized("Пользователь не авторизован");
        }

        var playlist = await _context.Playlists.FirstOrDefaultAsync(p => p.Id == playlistId && p.UserId == userId);
        if (playlist == null)
        {
            return NotFound("Плейлист не найден или у вас нет прав на его редактирование");
        }

        var trackExists = await _context.Tracks.AnyAsync(t => t.Id == trackId);
        if (!trackExists)
        {
            return NotFound("Трек не найден");
        }

        var alreadyAdded = await _context.PlaylistTracks.AnyAsync(pt => pt.PlaylistId == playlistId && pt.TrackId == trackId);
        if (alreadyAdded)
        {
            return BadRequest("Этот трек уже есть в данном плейлисте");
        }

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

        var playlists = await _context.Playlists
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .Select(p => new
            {
                p.Id,
                p.Title,
                p.CreatedAt
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

        var playlist = await _context.Playlists
            .Include(p => p.PlaylistTracks)
                .ThenInclude(pt => pt.Track)
            .FirstOrDefaultAsync(p => p.Id == id && p.UserId == userId);

        if (playlist == null) return NotFound("Плейлист не найден или доступ запрещен");

        var result = new
        {
            playlist.Id,
            playlist.Title,
            playlist.CreatedAt,
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