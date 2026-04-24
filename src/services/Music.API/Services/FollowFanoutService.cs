using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Models;

namespace Music.API.Services;

/// <summary>
/// Рассылка уведомлений подписчикам артиста при новом релизе.
/// Берём всех подписчиков через SELECT и
/// создаём N записей в Notifications + N SignalR-пушей
/// </summary>
public class FollowFanoutService
{
    private readonly AppDbContext _db;
    private readonly NotificationService _notify;

    public FollowFanoutService(AppDbContext db, NotificationService notify)
    {
        _db = db;
        _notify = notify;
    }

    public async Task FanOutNewAlbumAsync(
        Guid artistId,
        Guid albumId,
        string albumTitle,
        string artistName,
        CancellationToken ct = default)
    {
        await FanOutAsync(
            artistId,
            NotificationTypes.ArtistReleasedAlbum,
            new
            {
                artistId,
                artistName,
                albumId,
                albumTitle
            },
            ct);
    }

    public async Task FanOutNewTrackAsync(
        Guid artistId,
        Guid trackId,
        string trackTitle,
        string artistName,
        CancellationToken ct = default)
    {
        await FanOutAsync(
            artistId,
            NotificationTypes.ArtistReleasedTrack,
            new
            {
                artistId,
                artistName,
                trackId,
                trackTitle
            },
            ct);
    }

    private async Task FanOutAsync(Guid artistId, string type, object payload, CancellationToken ct)
    {
        var followerIds = await _db.Follows
            .Where(f => f.TargetType == FollowTargetType.Artist && f.TargetId == artistId)
            .Select(f => f.FollowerUserId)
            .ToListAsync(ct);

        foreach (var uid in followerIds)
        {
            try
            {
                await _notify.CreateAsync(uid, type, payload, ct);
            }
            catch
            {
                // TODO логгировать
            }
        }
    }
}