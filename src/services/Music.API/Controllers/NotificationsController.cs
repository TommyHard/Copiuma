using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Services;
using System.Security.Claims;
using System.Text.Json;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly NotificationService _svc;

    public NotificationsController(AppDbContext db, NotificationService svc)
    {
        _db = db;
        _svc = svc;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] bool unreadOnly = false,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50)
    {
        take = Math.Clamp(take, 1, 100);
        skip = Math.Max(0, skip);

        var q = _db.Notifications.Where(n => n.UserId == UserId);
        if (unreadOnly) q = q.Where(n => !n.IsRead);

        var items = await q
            .OrderByDescending(n => n.CreatedAt)
            .Skip(skip)
            .Take(take)
            .Select(n => new { n.Id, n.Type, n.Payload, n.IsRead, n.CreatedAt })
            .ToListAsync();

        var result = items.Select(n =>
        {
            var payloadJson = JsonSerializer.Deserialize<JsonElement>(n.Payload);
            var (title, message) = NotificationFormatter.Format(n.Type, payloadJson);

            return new NotificationResponse(
                n.Id,
                n.Type,
                title,
                message,
                payloadJson,
                n.IsRead,
                n.CreatedAt);
        });

        return Ok(result);
    }

    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount()
    {
        var count = await _svc.CountUnreadAsync(UserId);
        return Ok(new { count });
    }

    [HttpPost("{id}/read")]
    public async Task<IActionResult> MarkRead(Guid id)
    {
        var ok = await _svc.MarkReadAsync(UserId, id);
        return ok ? NoContent() : NotFound();
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        var n = await _svc.MarkAllReadAsync(UserId);
        return Ok(new { updated = n });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var ok = await _svc.DeleteAsync(UserId, id, ct);
        return ok ? NoContent() : NotFound();
    }

    /// <summary>
    /// Удалить все уведомления пользователя
    /// readOnly=true — удалить только уже прочитанные (для кнопки "очистить прочитанные")
    /// </summary>
    [HttpDelete]
    public async Task<IActionResult> DeleteAll([FromQuery] bool readOnly = false, CancellationToken ct = default)
    {
        var n = await _svc.DeleteAllAsync(UserId, readOnly, ct);
        return Ok(new { deleted = n });
    }
}