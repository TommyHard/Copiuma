using System.Security.Claims;
using Identity.API.Data;
using Identity.API.Dtos;
using Identity.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Identity.API.Controllers;

/// <summary>
/// Auth-hardening: список активных сессий (refresh-token'ов) пользователя
/// </summary>
[ApiController]
[Route("auth/sessions")]
[Authorize]
public class SessionsController : ControllerBase
{
    private readonly AppDbContext _db;

    public SessionsController(AppDbContext db) => _db = db;

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
        return NoContent();
    }

    /// <summary>
    /// Реворкаем всё, кроме текущей сессии (если клиент передал X-Refresh-Token)
    /// Если не передал — реворкаем вообще всё; пользователю придётся залогиниться заново
    /// </summary>
    [HttpDelete]
    public async Task<IActionResult> RevokeAllExceptCurrent(CancellationToken ct)
    {
        var currentRefresh = Request.Headers["X-Refresh-Token"].FirstOrDefault();

        var query = _db.RefreshTokens
            .Where(t => t.UserId == UserId && !t.IsRevoked);

        if (!string.IsNullOrEmpty(currentRefresh))
            query = query.Where(t => t.Token != currentRefresh);

        await query.ExecuteUpdateAsync(
            u => u.SetProperty(t => t.IsRevoked, true), ct);

        return NoContent();
    }
}