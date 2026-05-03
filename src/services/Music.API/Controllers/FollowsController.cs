using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Controllers;

/// <summary>
/// Полиморфные подписки юзера: на артистов, других юзеров, плейлисты
/// Плюс лента новых релизов от артистов
/// </summary>
[ApiController]
[Authorize]
[Route("[controller]")]
public class FollowsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly NotificationService _notify;
    private readonly FileStorageService _storage;
    private readonly ModerationService _moderation;

    public FollowsController(
        AppDbContext db,
        NotificationService notify,
        FileStorageService storage,
        ModerationService moderation)
    {
        _db = db;
        _notify = notify;
        _storage = storage;
        _moderation = moderation;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // Artists

    [HttpPost("artists/{artistId:guid}")]
    public async Task<IActionResult> FollowArtist(Guid artistId, CancellationToken ct)
    {
        if (!await _db.Artists.AnyAsync(a => a.Id == artistId, ct))
            return NotFound("Артист не найден.");

        await UpsertFollowAsync(FollowTargetType.Artist, artistId, ct);
        return Ok(new { Following = true });
    }

    [HttpDelete("artists/{artistId:guid}")]
    public async Task<IActionResult> UnfollowArtist(Guid artistId, CancellationToken ct)
    {
        var removed = await DeleteFollowAsync(FollowTargetType.Artist, artistId, ct);
        return Ok(new { Following = false, Removed = removed });
    }

    [HttpGet("artists")]
    public async Task<IActionResult> GetFollowedArtists(CancellationToken ct)
    {
        var me = UserId;

        var list = await (
            from f in _db.Follows
            where f.FollowerUserId == me && f.TargetType == FollowTargetType.Artist
            join a in _db.Artists on f.TargetId equals a.Id
            orderby f.CreatedAt descending
            select new FollowedArtistItem(
                a.Id,
                a.Name,
                a.AvatarKey,
                _db.Follows.Count(x => x.TargetType == FollowTargetType.Artist && x.TargetId == a.Id),
                f.CreatedAt)
        ).ToListAsync(ct);

        return Ok(list);
    }

    // Users

    [HttpPost("users/{userId:guid}")]
    public async Task<IActionResult> FollowUser(Guid userId, CancellationToken ct)
    {
        if (userId == UserId) return BadRequest("Нельзя подписаться на себя.");

        var added = await UpsertFollowAsync(FollowTargetType.User, userId, ct);

        if (added)
        {
            var me = UserId;
            var mutual = await _db.Follows.AnyAsync(
                f => f.FollowerUserId == userId
                    && f.TargetType == FollowTargetType.User
                    && f.TargetId == me, ct);

            try
            {
                await _notify.CreateAsync(userId, NotificationTypes.UserFollowedYou, new { followerUserId = me }, ct);
                if (mutual)
                {
                    await _notify.CreateAsync(me, NotificationTypes.BecameFriends, new { userId }, ct);
                    await _notify.CreateAsync(userId, NotificationTypes.BecameFriends, new { userId = me }, ct);
                }
            }
            catch { }
        }

        return Ok(new { Following = true });
    }

    [HttpDelete("users/{userId:guid}")]
    public async Task<IActionResult> UnfollowUser(Guid userId, CancellationToken ct)
    {
        var removed = await DeleteFollowAsync(FollowTargetType.User, userId, ct);
        return Ok(new { Following = false, Removed = removed });
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetFollowedUsers(CancellationToken ct)
    {
        var me = UserId;

        var list = await _db.Follows
            .Where(f => f.FollowerUserId == me && f.TargetType == FollowTargetType.User)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new FollowedUserItem(
                f.TargetId,
                _db.Follows.Any(x => x.FollowerUserId == f.TargetId
                                     && x.TargetType == FollowTargetType.User
                                     && x.TargetId == me),
                f.CreatedAt))
            .ToListAsync(ct);

        return Ok(list);
    }

    // Playlists

    [HttpPost("playlists/{playlistId:guid}")]
    public async Task<IActionResult> FollowPlaylist(Guid playlistId, CancellationToken ct)
    {
        var playlist = await _db.Playlists.FindAsync(new object?[] { playlistId }, ct);
        if (playlist is null) return NotFound("Плейлист не найден.");

        if (playlist.Visibility != PlaylistVisibility.Public)
        {
            var isMember = await _db.PlaylistMembers.AnyAsync(
                pm => pm.PlaylistId == playlistId && pm.UserId == UserId, ct);
            if (!isMember) return Forbid();
        }

        await UpsertFollowAsync(FollowTargetType.Playlist, playlistId, ct);
        return Ok(new { Following = true });
    }

    [HttpDelete("playlists/{playlistId:guid}")]
    public async Task<IActionResult> UnfollowPlaylist(Guid playlistId, CancellationToken ct)
    {
        var removed = await DeleteFollowAsync(FollowTargetType.Playlist, playlistId, ct);
        return Ok(new { Following = false, Removed = removed });
    }

    [HttpGet("playlists")]
    public async Task<IActionResult> GetFollowedPlaylists(CancellationToken ct)
    {
        var me = UserId;

        var list = await (
            from f in _db.Follows
            where f.FollowerUserId == me && f.TargetType == FollowTargetType.Playlist
            join p in _db.Playlists on f.TargetId equals p.Id
            orderby f.CreatedAt descending
            select new FollowedPlaylistItem(p.Id, p.Title, f.CreatedAt)
        ).ToListAsync(ct);

        return Ok(list);
    }

    // Friends

    [HttpGet("friends")]
    public async Task<IActionResult> GetFriends(CancellationToken ct)
    {
        var me = UserId;

        var outgoing = _db.Follows
            .Where(f => f.FollowerUserId == me && f.TargetType == FollowTargetType.User);

        var list = await (
            from o in outgoing
            join i in _db.Follows
                on new { F = o.TargetId, T = me }
                equals new { F = i.FollowerUserId, T = i.TargetId }
            where i.TargetType == FollowTargetType.User
            orderby o.CreatedAt descending
            select new FriendItem(o.TargetId, o.CreatedAt)
        ).ToListAsync(ct);

        return Ok(list);
    }

    /// <summary>
    /// Лента активности подписок: недавние прослушивания пользователей,
    /// на которых подписан текущий юзер
    /// Дедупликация по (UserId, TrackId), сортировка по последнему StartedAt
    /// </summary>
    /// <param name="take">1-50 (по умолчанию 20)</param>
    /// <param name="sinceDays">1-90 (по умолчанию 14)</param>
    [HttpGet("friends/feed")]
    public async Task<IActionResult> GetFriendsFeed(
        [FromQuery] int take = 20,
        [FromQuery] int sinceDays = 14,
        CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 50);
        sinceDays = Math.Clamp(sinceDays, 1, 90);
        var since = DateTime.UtcNow.AddDays(-sinceDays);
        var me = UserId;

        // Все пользователи, на которых я подписан
        var followedUserIds = await _db.Follows
            .Where(f => f.FollowerUserId == me && f.TargetType == FollowTargetType.User)
            .Select(f => f.TargetId)
            .Distinct()
            .ToListAsync(ct);

        if (followedUserIds.Count == 0) return Ok(Array.Empty<object>());

        // Последнее прослушивание каждой пары (пользователь, трек)
        var rawEvents = await _db.PlayEvents
            .Where(p => followedUserIds.Contains(p.UserId) && p.StartedAt >= since)
            .GroupBy(p => new { p.UserId, p.TrackId })
            .Select(g => new
            {
                g.Key.UserId,
                g.Key.TrackId,
                LastPlayedAt = g.Max(x => x.StartedAt),
            })
            .OrderByDescending(x => x.LastPlayedAt)
            .Take(take)
            .ToListAsync(ct);

        if (rawEvents.Count == 0) return Ok(Array.Empty<object>());

        var trackIds = rawEvents.Select(e => e.TrackId).Distinct().ToList();
        var trackData = await _moderation.ApplyVisibilityFilter(_db.Tracks, me)
            .Where(t => trackIds.Contains(t.Id))
            .Select(t => new
            {
                t.Id,
                t.Title,
                t.Artist,
                t.ArtistId,
                t.AlbumId,
                AlbumTitle = t.Album != null ? t.Album.Title : null,
                t.TrackNumber,
                t.Duration,
                t.IsExplicit,
                t.UploadedAt,
                t.CoverKey,
                AlbumCoverKey = t.Album != null ? t.Album.CoverKey : null,
                FeaturedArtists = _db.TrackFeaturedArtists
                    .Where(fa => fa.TrackId == t.Id)
                    .OrderBy(fa => fa.Position)
                    .Select(fa => new { fa.Artist!.Id, fa.Artist.Name })
                    .ToList(),
                IsLikedByMe = _db.LikedTracks.Any(l => l.TrackId == t.Id && l.UserId == me),
            })
            .ToListAsync(ct);

        var trackMap = trackData.ToDictionary(x => x.Id);

        var coverUrlByTrack = new Dictionary<Guid, string?>();
        foreach (var t in trackData)
        {
            var key = t.CoverKey ?? t.AlbumCoverKey;
            coverUrlByTrack[t.Id] = key is null
                ? null
                : await _storage.GeneratePresignedImageGetUrlAsync(key);
        }

        var result = rawEvents
            .Where(e => trackMap.ContainsKey(e.TrackId))
            .Select(e =>
            {
                var t = trackMap[e.TrackId];
                return new
                {
                    e.UserId,
                    e.LastPlayedAt,
                    Track = new
                    {
                        t.Id,
                        t.Title,
                        t.Artist,
                        t.ArtistId,
                        t.AlbumId,
                        t.AlbumTitle,
                        t.TrackNumber,
                        t.Duration,
                        t.IsExplicit,
                        t.UploadedAt,
                        CoverUrl = coverUrlByTrack[t.Id],
                        t.FeaturedArtists,
                        t.IsLikedByMe,
                    }
                };
            })
            .ToList();

        return Ok(result);
    }

    // Feed

    /// <summary>
    /// Лента новых релизов от артистов, на которых подписан пользователь
    /// Union треков (TracksController upload) и альбомов (AlbumsController create)
    /// </summary>
    /// <param name="take">1-50, по умолчанию 20</param>
    /// <param name="sinceDays">Окно в днях (1-180, по умолчанию 60)</param>
    /// <param name="before">Указатель: вернуть только то, что &lt; before</param>
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

        var me = UserId;

        var followedArtistIds = await _db.Follows
            .Where(f => f.FollowerUserId == me && f.TargetType == FollowTargetType.Artist)
            .Select(f => f.TargetId)
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
                a.CreatedAt,
                null))
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
                t.UploadedAt,
                t.Duration))
            .ToListAsync(ct);

        var merged = albums.Concat(tracks)
            .OrderByDescending(x => x.ReleasedAt)
            .Take(take)
            .ToList();

        return Ok(merged);
    }

    // helpers

    private async Task<bool> UpsertFollowAsync(FollowTargetType type, Guid targetId, CancellationToken ct)
    {
        var me = UserId;
        var exists = await _db.Follows.AnyAsync(
            f => f.FollowerUserId == me && f.TargetType == type && f.TargetId == targetId, ct);

        if (exists) return false;

        _db.Follows.Add(new Follow
        {
            FollowerUserId = me,
            TargetType = type,
            TargetId = targetId,
            CreatedAt = DateTime.UtcNow
        });
        await _db.SaveChangesAsync(ct);
        return true;
    }

    private async Task<bool> DeleteFollowAsync(FollowTargetType type, Guid targetId, CancellationToken ct)
    {
        var me = UserId;
        var affected = await _db.Follows
            .Where(f => f.FollowerUserId == me && f.TargetType == type && f.TargetId == targetId)
            .ExecuteDeleteAsync(ct);
        return affected > 0;
    }
}