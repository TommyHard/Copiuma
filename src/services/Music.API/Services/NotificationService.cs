using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Hubs;
using Music.API.Models;
using System.Text.Json;

namespace Music.API.Services;

public class NotificationService
{
    private readonly AppDbContext _db;
    private readonly IHubContext<NotificationHub> _hub;

    public NotificationService(AppDbContext db, IHubContext<NotificationHub> hub)
    {
        _db = db;
        _hub = hub;
    }

    public async Task<Notification> CreateAsync(
        Guid userId,
        string type,
        object payload,
        CancellationToken ct = default)
    {
        var json = JsonSerializer.Serialize(payload);
        var payloadElement = JsonSerializer.Deserialize<JsonElement>(json);

        var (title, message) = NotificationFormatter.Format(type, payloadElement);

        var n = new Notification
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = type,
            Payload = json,
            CreatedAt = DateTime.UtcNow
        };

        _db.Notifications.Add(n);
        await _db.SaveChangesAsync(ct);

        await _hub.Clients.Group($"user-{userId}")
            .SendAsync("NotificationReceived", new
            {
                id = n.Id,
                type = n.Type,
                title = title,
                message = message,
                payload,
                isRead = false,
                createdAt = n.CreatedAt
            }, ct);

        return n;
    }

    public Task<int> CountUnreadAsync(Guid userId, CancellationToken ct = default) =>
        _db.Notifications.CountAsync(x => x.UserId == userId && !x.IsRead, ct);

    public async Task<bool> MarkReadAsync(Guid userId, Guid notificationId, CancellationToken ct = default)
    {
        var n = await _db.Notifications
            .FirstOrDefaultAsync(x => x.Id == notificationId && x.UserId == userId, ct);
        if (n is null) return false;

        n.IsRead = true;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<int> MarkAllReadAsync(Guid userId, CancellationToken ct = default)
    {
        var items = await _db.Notifications
            .Where(x => x.UserId == userId && !x.IsRead)
            .ToListAsync(ct);
        foreach (var n in items) n.IsRead = true;
        await _db.SaveChangesAsync(ct);
        return items.Count;
    }

    public async Task<bool> DeleteAsync(Guid userId, Guid notificationId, CancellationToken ct = default)
    {
        var n = await _db.Notifications
            .FirstOrDefaultAsync(x => x.Id == notificationId && x.UserId == userId, ct);
        if (n is null) return false;

        _db.Notifications.Remove(n);
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<int> DeleteAllAsync(Guid userId, bool readOnly = false, CancellationToken ct = default)
    {
        var q = _db.Notifications.Where(x => x.UserId == userId);
        if (readOnly) q = q.Where(x => x.IsRead);

        var items = await q.ToListAsync(ct);
        if (items.Count == 0) return 0;

        _db.Notifications.RemoveRange(items);
        await _db.SaveChangesAsync(ct);
        return items.Count;
    }
}