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
    public IQueryable<Track> ApplyVisibilityFilter(IQueryable<Track> q, Guid? viewerUserId = null)
    {
        var now = DateTime.UtcNow;

        // Soft-delete фильтр
        q = q.Where(t => t.DeletedAt == null);

        // Shadowban фильтр — NOT EXISTS (active Shadowbanned flag) для uploader,
        // кроме случая когда viewer - uploader
        q = q.Where(t =>
            viewerUserId != null && t.UploadedByUserId == viewerUserId
            || !_db.UserFlags.Any(f =>
                f.UserId == t.UploadedByUserId
                && f.Kind == UserFlagKind.Shadowbanned
                && (f.ExpiresAt == null || f.ExpiresAt > now)));

        return q;
    }
}