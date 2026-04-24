using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using System.Security.Claims;

namespace Music.API.Controllers;

/// <summary>
/// Подписки пользователя на артистов + лента новых релизов от подписок
/// </summary>
[ApiController]
[Authorize]
[Route("[controller]")]
public class FollowsController : ControllerBase
{
    private readonly AppDbContext _db;

    public FollowsController(AppDbContext db)
    {
        _db = db;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost("artists/{artistId:guid}")]
    public async Task<IActionResult> FollowArtist(Guid artistId, CancellationToken ct)
    {
        if (!await _db.Artists.AnyAsync(a => a.Id == artistId, ct))
            return NotFound("Артист не найден.");

        var exists = await _db.Follows
            .AnyAsync(f => f.FollowerUserId == UserId && f.ArtistId == artistId, ct);

        if (!exists)
        {
            _db.Follows.Add(new Follow
            {
                FollowerUserId = UserId,
                ArtistId = artistId,
                CreatedAt = DateTime.UtcNow
            });
            await _db.SaveChangesAsync(ct);
        }

        return Ok(new { Following = true });
    }

    [HttpDelete("artists/{artistId:guid}")]
    public async Task<IActionResult> UnfollowArtist(Guid artistId, CancellationToken ct)
    {
        var affected = await _db.Follows
            .Where(f => f.FollowerUserId == UserId && f.ArtistId == artistId)
            .ExecuteDeleteAsync(ct);

        return Ok(new { Following = false, Removed = affected > 0 });
    }

    [HttpGet]
    public async Task<IActionResult> GetMyFollows(CancellationToken ct)
    {
        var list = await _db.Follows
            .Where(f => f.FollowerUserId == UserId)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new FollowedArtistItem(
                f.ArtistId,
                f.Artist!.Name,
                f.Artist.AvatarKey,
                _db.Follows.Count(x => x.ArtistId == f.ArtistId),
                f.CreatedAt))
            .ToListAsync(ct);

        return Ok(list);
    }

    /// <summary>
    /// Лента новых релизов от артистов, на которых подписан пользователь
    /// Union треков (TracksController upload) и альбомов (AlbumsController create)
    /// </summary>
    /// <param name="take">1-50, по умолчанию 20</param>
    /// <param name="sinceDays">Окно в днях (1-180, по умолчанию 60)</param>
    /// <param name="before">Указатель: вернуть только то, что <= before</param>
    [HttpGet("feed")]
    public async Task<IActionResult> GetFeed(
        [FromQuery] int take = 20,
        [FromQuery] int sinceDays = 60,
        [FromQuery] DateTime? before = null,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 50);
        sinceDays = Math.Clamp(sinceDays, 1, 180);
        var since = DateTime.UtcNow.AddDays(-sinceDays);

        var followedArtistIds = await _db.Follows
            .Where(f => f.FollowerUserId == UserId)
            .Select(f => f.ArtistId)
            .ToListAsync(ct);

        if (followedArtistIds.Count == 0)
        { 
            return Ok(Array.Empty<FeedItem>()); 
        }

        var albumsQuery = _db.Albums
            .Where(a => followedArtistIds.Contains(a.ArtistId) && a.CreatedAt >= since);
        if (before.HasValue)
        {
            albumsQuery = albumsQuery.Where(a => a.CreatedAt < before.Value);
        }

        var albums = await albumsQuery
            .OrderByDescending(a => a.CreatedAt)
            .Take(take * 2)
            .Select(a => new FeedItem(
                "album",
                a.Id,
                a.Title,
                a.ArtistId,
                a.Artist!.Name,
                a.CoverKey,
                a.CreatedAt))
            .ToListAsync(ct);

        var tracksQuery = _db.Tracks
            .Where(t => t.ArtistId != null
                        && followedArtistIds.Contains(t.ArtistId.Value)
                        && t.AlbumId == null
                        && t.UploadedAt >= since);
        if (before.HasValue) tracksQuery = tracksQuery.Where(t => t.UploadedAt < before.Value);

        var tracks = await tracksQuery
            .OrderByDescending(t => t.UploadedAt)
            .Take(take * 2)
            .Select(t => new FeedItem(
                "track",
                t.Id,
                t.Title,
                t.ArtistId!.Value,
                t.ArtistEntity!.Name,
                null,
                t.UploadedAt))
            .ToListAsync(ct);

        var merged = albums.Concat(tracks)
            .OrderByDescending(x => x.ReleasedAt)
            .Take(take)
            .ToList();

        return Ok(merged);
    }
}