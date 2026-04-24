using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Music.API.Models;
using System.Security.Claims;
using System.Text.Json;

namespace Music.API.Data;

public class ChangelogInterceptor : SaveChangesInterceptor
{
    private readonly IHttpContextAccessor _http;

    private static readonly Dictionary<string, string[]> Tracked =
        new(StringComparer.Ordinal)
        {
            ["Playlist"] = new[] { "Title" },
            ["Track"] = new[] { "Title", "Artist", "ArtistId", "AlbumId", "TrackNumber", "Duration" },
            ["Artist"] = new[] { "Name", "Bio", "AvatarKey" },
            ["Album"] = new[] { "Title", "ArtistId", "ReleaseDate", "CoverKey" },
            ["PlaylistInvitation"] = new[] { "Status" },
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
                    if (p.IsModified && !Equals(p.OriginalValue, p.CurrentValue))
                    {
                        diff[propName] = new { old = p.OriginalValue, @new = p.CurrentValue };
                    }
                    break;
            }
        }

        return diff.Count == 0 ? null : diff;
    }

    private static Guid? TryGetEntityId(EntityEntry entry)
    {
        var idProp = entry.Metadata.FindPrimaryKey()?.Properties.FirstOrDefault();
        if (idProp is null) return null;

        var value = entry.Property(idProp.Name).CurrentValue;
        return value is Guid g ? g : null;
    }

    private Guid? GetActorUserId()
    {
        var user = _http.HttpContext?.User;
        var idStr = user?.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(idStr, out var id) ? id : null;
    }
}