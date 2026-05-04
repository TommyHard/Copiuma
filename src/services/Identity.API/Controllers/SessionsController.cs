using System.Security.Claims;
using Identity.API.Data;
using Identity.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

namespace Identity.API.Controllers;

[ApiController]
[Route("auth/sessions")]
[Authorize]
public class SessionsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConnectionMultiplexer _redis;

    public SessionsController(AppDbContext db, IConnectionMultiplexer redis)
    {
        _db = db;
        _redis = redis;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var currentRefresh = Request.Headers["X-Refresh-Token"].FirstOrDefault();

        var sessions = await _db.RefreshTokens
            .Where(t => t.UserId == UserId && !t.IsRevoked && t.ExpiryDate > DateTime.UtcNow)
            .OrderByDescending(t => t.LastUsedAt ?? t.CreatedAt)
            .Select(t => new SessionResponse(
                t.Id,
                t.DeviceLabel ?? "Неизвестное устройство",
                t.IpAddress,
                t.UserAgent,
                t.CreatedAt,
                t.LastUsedAt,
                t.ExpiryDate,
                currentRefresh != null && t.Token == currentRefresh))
            .ToListAsync(ct);

        return Ok(sessions);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Revoke(Guid id, CancellationToken ct)
    {
        var token = await _db.RefreshTokens
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == UserId, ct);

        if (token is null) return NotFound();

        token.IsRevoked = true;
        await _db.SaveChangesAsync(ct);

        // Kill сессию в Redis
        await _redis.GetDatabase().KeyDeleteAsync($"active_session:{token.Id}");

        return NoContent();
    }

    [HttpDelete]
    public async Task<IActionResult> RevokeAllExceptCurrent(CancellationToken ct)
    {
        var currentRefresh = Request.Headers["X-Refresh-Token"].FirstOrDefault();

        var query = _db.RefreshTokens
            .Where(t => t.UserId == UserId && !t.IsRevoked);

        if (!string.IsNullOrEmpty(currentRefresh))
            query = query.Where(t => t.Token != currentRefresh);

        var tokensToRevoke = await query.ToListAsync(ct);
        var redisDb = _redis.GetDatabase();

        foreach (var t in tokensToRevoke)
        {
            t.IsRevoked = true;
            await redisDb.KeyDeleteAsync($"active_session:{t.Id}");
        }

        await _db.SaveChangesAsync(ct);

        return NoContent();
    }
}