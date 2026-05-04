using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Models;

namespace Music.API.Services;

/// <summary>
/// Главные инварианты, которые сервис делает:
///   - Shadowban user видит свой контент только сам
///   - Muted юзер не может создавать жалобы/ревью
/// </summary>
public class ModerationService
{
    private readonly AppDbContext _db;

    public ModerationService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<bool> HasActiveFlagAsync(Guid userId, UserFlagKind kind, CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        return await _db.UserFlags.AnyAsync(
            f => f.UserId == userId
                 && f.Kind == kind
                 && (f.ExpiresAt == null || f.ExpiresAt > now),
            ct);
    }

    public Task<bool> IsShadowbannedAsync(Guid userId, CancellationToken ct = default) =>
        HasActiveFlagAsync(userId, UserFlagKind.Shadowbanned, ct);

    public Task<bool> IsMutedAsync(Guid userId, CancellationToken ct = default) =>
        HasActiveFlagAsync(userId, UserFlagKind.Muted, ct);

    /// <summary>
    /// Фильтр видимых треков: не удалённые + uploader не в активном shadowban
    /// Применяется в списке, поиске, feed, рекомендациях
    /// Если viewerUserId = uploader, shadowban игнорируется (user видит свой контент)
    /// </summary>
    public IQueryable<Track> ApplyVisibilityFilter(IQueryable<Track> q, Guid? viewerUserId = null, bool hideDislikes = true, bool hideBlocked = true)
    {
        var now = DateTime.UtcNow;

        q = q.Where(t => t.DeletedAt == null);

        // Shadowban фильтр
        q = q.Where(t =>
            viewerUserId != null && t.UploadedByUserId == viewerUserId
            || !_db.UserFlags.Any(f =>
                f.UserId == t.UploadedByUserId
                && f.Kind == UserFlagKind.Shadowbanned
                && (f.ExpiresAt == null || f.ExpiresAt > now)));

        if (viewerUserId.HasValue)
        {
            // ЖЕСТКИЙ БЛОК только если hideBlocked = true
            if (hideBlocked)
            {
                q = q.Where(t =>
                    (t.ArtistId == null || !_db.UserBlockedArtists.Any(b => b.UserId == viewerUserId.Value && b.ArtistId == t.ArtistId)) &&
                    !_db.TrackFeaturedArtists.Any(fa => fa.TrackId == t.Id && _db.UserBlockedArtists.Any(b => b.UserId == viewerUserId.Value && b.ArtistId == fa.ArtistId))
                );
            }

            // Дизлайки
            if (hideDislikes)
            {
                q = q.Where(t => !_db.UserDislikes.Any(d => d.UserId == viewerUserId.Value && d.TargetType == DislikeTargetType.Track && d.TargetId == t.Id));
                q = q.Where(t => t.ArtistId == null || !_db.UserDislikes.Any(d => d.UserId == viewerUserId.Value && d.TargetType == DislikeTargetType.Artist && d.TargetId == t.ArtistId));
            }
        }

        return q;
    }
}