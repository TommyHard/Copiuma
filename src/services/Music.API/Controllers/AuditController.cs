using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using System.Security.Claims;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class AuditController : ControllerBase
{
    private readonly AppDbContext _db;

    public AuditController(AppDbContext db)
    {
        _db = db;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("mine")]
    public async Task<IActionResult> Mine(
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50)
    {
        skip = Math.Max(0, skip);
        take = Math.Clamp(take, 1, 200);

        var items = await _db.AuditEvents
            .Where(x => x.UserId == UserId)
            .OrderByDescending(x => x.CreatedAt)
            .Skip(skip).Take(take)
            .Select(x => new
            {
                x.Id,
                x.Action,
                x.Method,
                x.Path,
                x.StatusCode,
                x.DurationMs,
                x.CorrelationId,
                x.CreatedAt
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> All(
        [FromQuery] Guid? userId = null,
        [FromQuery] string? action = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int? status = null,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50)
    {
        skip = Math.Max(0, skip);
        take = Math.Clamp(take, 1, 500);

        var q = _db.AuditEvents.AsQueryable();

        if (userId.HasValue) q = q.Where(x => x.UserId == userId);
        if (!string.IsNullOrWhiteSpace(action)) q = q.Where(x => x.Action == action);
        if (from.HasValue) q = q.Where(x => x.CreatedAt >= from.Value);
        if (to.HasValue) q = q.Where(x => x.CreatedAt <= to.Value);
        if (status.HasValue) q = q.Where(x => x.StatusCode == status.Value);

        var total = await q.CountAsync();

        var items = await q
            .OrderByDescending(x => x.CreatedAt)
            .Skip(skip).Take(take)
            .Select(x => new
            {
                x.Id,
                x.UserId,
                x.Action,
                x.Method,
                x.Path,
                x.StatusCode,
                x.DurationMs,
                x.IpAddress,
                x.UserAgent,
                x.CorrelationId,
                x.CreatedAt
            })
            .ToListAsync();

        return Ok(new { total, items });
    }
}