using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Controllers;

/// <summary>
/// Жалобы на контент
///
///   POST   /reports                    — создать жалобу (любой user, кроме muted)
///   GET    /reports/mine               — мои жалобы
///   GET    /reports?status=Open        — очередь модерации [Admin]
///   POST   /reports/{id}/resolve       — рассмотреть [Admin]
///
/// Ограничения:
///   - Нельзя репортить свой же контент
///   - Нельзя репортить один и тот же объект дважды за 24ч
///   - Muted user не может создавать жалобы вообще
///   - Resolve = либо Actioned (админ принял меры), либо Dismissed
/// </summary>
[ApiController]
[Authorize]
[Route("[controller]")]
public class ReportsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ModerationService _mod;

    private static readonly HashSet<string> AllowedReasons = new(StringComparer.OrdinalIgnoreCase)
    {
        "spam", "copyright", "offensive", "harassment", "illegal", "other"
    };

    public ReportsController(AppDbContext db, ModerationService mod)
    {
        _db = db;
        _mod = mod;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateReportRequest request, CancellationToken ct)
    {
        if (!AllowedReasons.Contains(request.Reason))
            return BadRequest($"Допустимые reason: {string.Join(", ", AllowedReasons)}.");

        if (request.Details is { Length: > 2000 })
            return BadRequest("Details не длиннее 2000 символов.");

        if (await _mod.IsMutedAsync(UserId, ct))
            return StatusCode(StatusCodes.Status403Forbidden, "Ваш аккаунт ограничен на создание жалоб.");

        // Target должен реально существовать. Проверяем в зависимости от типа
        var exists = request.TargetType switch
        {
            ReportTargetType.Track => await _db.Tracks.AnyAsync(t => t.Id == request.TargetId && t.DeletedAt == null, ct),
            ReportTargetType.Review => await _db.TrackReviews.AnyAsync(r => r.Id == request.TargetId && !r.IsDeleted, ct),
            ReportTargetType.User => request.TargetId != Guid.Empty,
            _ => false
        };
        if (!exists) return NotFound("Объект жалобы не найден.");

        // Не репортим свой же контент
        if (request.TargetType == ReportTargetType.Track)
        {
            var uploader = await _db.Tracks
                .Where(t => t.Id == request.TargetId)
                .Select(t => (Guid?)t.UploadedByUserId)
                .FirstOrDefaultAsync(ct);
            if (uploader == UserId) return BadRequest("Нельзя репортить собственный трек.");
        }
        if (request.TargetType == ReportTargetType.User && request.TargetId == UserId)
            return BadRequest("Нельзя репортить самого себя.");

        // Анти-спам: один и тот же чел -> один и тот же объект -> не чаще раза в сутки
        var dayAgo = DateTime.UtcNow.AddDays(-1);
        var duplicate = await _db.Reports.AnyAsync(
            r => r.ReporterUserId == UserId
                 && r.TargetType == request.TargetType
                 && r.TargetId == request.TargetId
                 && r.CreatedAt > dayAgo,
            ct);
        if (duplicate) return Conflict("Вы уже репортили этот объект сегодня.");

        var report = new Report
        {
            Id = Guid.NewGuid(),
            ReporterUserId = UserId,
            TargetType = request.TargetType,
            TargetId = request.TargetId,
            Reason = request.Reason.ToLowerInvariant(),
            Details = string.IsNullOrWhiteSpace(request.Details) ? null : request.Details.Trim(),
            Status = ReportStatus.Open,
            CreatedAt = DateTime.UtcNow
        };

        _db.Reports.Add(report);
        await _db.SaveChangesAsync(ct);

        return Ok(new { report.Id, report.Status });
    }

    [HttpGet("mine")]
    public async Task<IActionResult> GetMine(CancellationToken ct)
    {
        var items = await _db.Reports
            .Where(r => r.ReporterUserId == UserId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReportItem(
                r.Id, r.ReporterUserId, r.TargetType, r.TargetId,
                r.Reason, r.Details, r.Status, r.CreatedAt,
                r.ResolvedAt, r.ResolutionNote))
            .ToListAsync(ct);
        return Ok(items);
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetQueue(
        [FromQuery] ReportStatus? status = ReportStatus.Open,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 50,
        CancellationToken ct = default)
    {
        skip = Math.Max(0, skip);
        take = Math.Clamp(take, 1, 200);

        IQueryable<Report> q = _db.Reports;
        if (status.HasValue) q = q.Where(r => r.Status == status.Value);

        var items = await q
            .OrderBy(r => r.CreatedAt)
            .Skip(skip).Take(take)
            .Select(r => new ReportItem(
                r.Id, r.ReporterUserId, r.TargetType, r.TargetId,
                r.Reason, r.Details, r.Status, r.CreatedAt,
                r.ResolvedAt, r.ResolutionNote))
            .ToListAsync(ct);

        return Ok(items);
    }

    [HttpPost("{id:guid}/resolve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Resolve(Guid id, [FromBody] ResolveReportRequest request, CancellationToken ct)
    {
        if (request.NewStatus is not ReportStatus.Actioned and not ReportStatus.Dismissed)
            return BadRequest("NewStatus должен быть Actioned или Dismissed.");

        var report = await _db.Reports.FindAsync(new object?[] { id }, ct);
        if (report is null) return NotFound();
        if (report.Status != ReportStatus.Open)
            return Conflict("Жалоба уже рассмотрена.");

        report.Status = request.NewStatus;
        report.ResolvedByUserId = UserId;
        report.ResolvedAt = DateTime.UtcNow;
        report.ResolutionNote = request.Note?.Trim();
        await _db.SaveChangesAsync(ct);

        return Ok(new { report.Id, report.Status, report.ResolvedAt });
    }
}