using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Music.API.Models;
using System.Security.Claims;
using System.Text.Json;

namespace Music.API.Data;

/// <summary>
/// На любое SaveChangesAsync() для
/// whitelist сущностей добавляет запись ChangeLogEntry в ту же
/// транзакцию. Хранит только изменённые поля.
/// </summary>
public class ChangelogInterceptor : SaveChangesInterceptor
{
    private readonly IHttpContextAccessor _http;

    /// <summary>
    /// Whitelist: имя типа -> набор свойств, чьи изменения важны
    /// Всё остальное в игнор (Notifications, Likes, Ratings
    /// </summary>
    private static readonly Dictionary<string, string[]> Tracked =
            new(StringComparer.Ordinal)
            {
                ["Playlist"] = new[] { "Title", "Visibility", "IsCollaborative" },
                ["PlaylistTrack"] = new[] { "TrackId", "Position" },
                ["PlaylistMember"] = new[] { "UserId", "Role" },

                ["Track"] = new[] { "Title", "Artist", "ArtistId", "AlbumId", "TrackNumber", "Duration", "Genres", "IsExplicit", "DeletedAt", "DeletionReason", "ProcessingStatus" },
                ["Artist"] = new[] { "Name", "Bio", "AvatarKey" },
                ["Album"] = new[] { "Title", "ArtistId", "ReleaseDate", "CoverKey", "Genres" },
                ["PlaylistInvitation"] = new[] { "Status" },
                ["UserFlag"] = new[] { "Kind", "ExpiresAt", "Note" },
                ["Report"] = new[] { "Status", "ResolvedByUserId", "ResolvedAt" },
            };

    public ChangelogInterceptor(IHttpContextAccessor http)
    {
        _http = http;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context is not AppDbContext ctx) return base.SavingChangesAsync(eventData, result, cancellationToken);

        var actor = GetActorUserId();

        var entries = ctx.ChangeTracker.Entries()
            .Where(e => Tracked.ContainsKey(e.Entity.GetType().Name))
            .Where(e => e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted)
            .ToList();

        foreach (var entry in entries)
        {
            var typeName = entry.Entity.GetType().Name;
            var watched = Tracked[typeName];
            var diff = BuildDiff(entry, watched);

            if (diff is null) continue;

            var entityId = TryGetEntityId(entry);
            if (entityId is null) continue;

            ctx.Add(new ChangeLogEntry
            {
                Id = Guid.NewGuid(),
                EntityType = typeName,
                EntityId = entityId.Value,
                Kind = entry.State switch
                {
                    EntityState.Added => ChangeKind.Created,
                    EntityState.Deleted => ChangeKind.Deleted,
                    _ => ChangeKind.Updated
                },
                ActorUserId = actor,
                Changes = JsonSerializer.Serialize(diff),
                CreatedAt = DateTime.UtcNow
            });
        }

        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private static Dictionary<string, object?>? BuildDiff(EntityEntry entry, string[] watched)
    {
        var diff = new Dictionary<string, object?>();

        foreach (var propName in watched)
        {
            var prop = entry.Metadata.FindProperty(propName);
            if (prop is null) continue;

            var p = entry.Property(propName);

            switch (entry.State)
            {
                case EntityState.Added:
                    diff[propName] = new { old = (object?)null, @new = p.CurrentValue };
                    break;

                case EntityState.Deleted:
                    diff[propName] = new { old = p.OriginalValue, @new = (object?)null };
                    break;

                case EntityState.Modified:
                    if (p.IsModified && !SmartEquals(p.OriginalValue, p.CurrentValue))
                    {
                        diff[propName] = new { old = p.OriginalValue, @new = p.CurrentValue };
                    }
                    break;
            }
        }

        return diff.Count == 0 ? null : diff;
    }

    private static bool SmartEquals(object? a, object? b)
    {
        if (ReferenceEquals(a, b)) return true;
        if (a is null || b is null) return false;
        if (a is string || b is string) return a.Equals(b);
        if (a is System.Collections.IEnumerable ea && b is System.Collections.IEnumerable eb)
            return ea.Cast<object?>().SequenceEqual(eb.Cast<object?>());
        return a.Equals(b);
    }

    private static Guid? TryGetEntityId(EntityEntry entry)
    {
        var typeName = entry.Entity.GetType().Name;

        if (typeName == "PlaylistTrack" || typeName == "PlaylistMember")
        {
            var playlistIdProp = entry.Metadata.FindProperty("PlaylistId");
            if (playlistIdProp != null)
            {
                var val = entry.Property("PlaylistId").CurrentValue;
                return val is Guid g ? g : null;
            }
        }

        var idProp = entry.Metadata.FindPrimaryKey()?.Properties.FirstOrDefault();
        if (idProp is null) return null;

        var value = entry.Property(idProp.Name).CurrentValue;
        return value is Guid guid ? guid : null;
    }

    private Guid? GetActorUserId()
    {
        var user = _http.HttpContext?.User;
        var idStr = user?.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(idStr, out var id) ? id : null;
    }
}