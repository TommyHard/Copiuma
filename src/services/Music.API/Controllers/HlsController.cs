using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Models;
using Music.API.Services;

namespace Music.API.Controllers;

/// <summary>
/// HTTP Live Streaming endpoints. Прокси к bucket "tracks-hls"
///
///   GET /tracks/{id}/hls/master.m3u8                   — мастер-плейлист
///   GET /tracks/{id}/hls/{variant}/index.m3u8          — плейлист варианта
///   GET /tracks/{id}/hls/{variant}/{segment}.ts        — TS-сегмент
///
/// Доступные варианты: low / mid / high (64/128/256 kbps AAC)
/// </summary>
[ApiController]
[Authorize]
[Route("tracks/{id:guid}/hls")]
public class HlsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly FileStorageService _storage;
    private readonly ModerationService _moderation;
    private readonly ILogger<HlsController> _log;

    private static readonly HashSet<string> AllowedVariants =
        new(StringComparer.Ordinal) { "low", "mid", "high" };

    private static readonly Regex SegmentNameRegex =
        new(@"^seg_\d{3,5}\.ts$", RegexOptions.Compiled);

    private const string M3u8ContentType = "application/vnd.apple.mpegurl";
    private const string TsContentType = "video/mp2t";

    public HlsController(
        AppDbContext db,
        FileStorageService storage,
        ModerationService moderation,
        ILogger<HlsController> log)
    {
        _db = db;
        _storage = storage;
        _moderation = moderation;
        _log = log;
    }

    [HttpGet("master.m3u8")]
    public Task<IActionResult> Master(Guid id, CancellationToken ct)
        => ServeAsync(id, $"{id:D}/master.m3u8", M3u8ContentType, ct);

    [HttpGet("{variant}/index.m3u8")]
    public Task<IActionResult> VariantPlaylist(Guid id, string variant, CancellationToken ct)
    {
        if (!AllowedVariants.Contains(variant))
            return Task.FromResult<IActionResult>(NotFound("Неизвестный вариант."));

        return ServeAsync(id, $"{id:D}/stream_{variant}/index.m3u8", M3u8ContentType, ct);
    }

    [HttpGet("{variant}/{segment}")]
    public Task<IActionResult> Segment(Guid id, string variant, string segment, CancellationToken ct)
    {
        if (!AllowedVariants.Contains(variant))
            return Task.FromResult<IActionResult>(NotFound("Неизвестный вариант."));

        if (!SegmentNameRegex.IsMatch(segment))
            return Task.FromResult<IActionResult>(NotFound("Невалидное имя сегмента."));

        return ServeAsync(id, $"{id:D}/stream_{variant}/{segment}", TsContentType, ct);
    }

    private async Task<IActionResult> ServeAsync(Guid id, string key, string contentType, CancellationToken ct)
    {
        var track = await _db.Tracks
            .AsNoTracking()
            .Where(t => t.Id == id)
            .Select(t => new
            {
                t.Id,
                t.DeletedAt,
                t.HlsStatus,
                t.UploadedByUserId
            })
            .FirstOrDefaultAsync(ct);

        if (track is null) return NotFound("Трек не найден.");
        if (track.DeletedAt != null) return NotFound("Трек недоступен.");

        if (await _moderation.IsShadowbannedAsync(track.UploadedByUserId))
            return NotFound("Трек недоступен.");

        if (track.HlsStatus != TrackHlsStatus.Ready)
        {
            return StatusCode(425, new
            {
                Status = track.HlsStatus.ToString(),
                Message = "HLS ещё не готов для этого трека."
            });
        }

        var stat = await _storage.StatHlsAsync(key, ct);
        if (!stat.Exists)
        {
            _log.LogWarning("HLS object missing despite HlsStatus=Ready: {Key}", key);
            return NotFound("Объект отсутствует в хранилище.");
        }

        Response.ContentType = contentType;
        Response.ContentLength = stat.Size;
        Response.Headers["Cache-Control"] = key.EndsWith(".ts")
            ? "public, max-age=31536000, immutable"
            : "public, max-age=60";

        await _storage.StreamHlsToAsync(key, Response.Body, ct);
        return new EmptyResult();
    }
}