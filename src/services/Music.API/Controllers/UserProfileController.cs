using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Controllers;

/// <summary>
/// Статистика профиля пользователя + загрузка/удаление аватара
/// Базовая информация (name, bio, genres)
/// </summary>
[ApiController]
[Authorize]
[Route("user-profile")]
public class UserProfileController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly FileStorageService _storage;
    private readonly IHttpClientFactory _httpFactory;

    public UserProfileController(AppDbContext db, FileStorageService storage, IHttpClientFactory httpFactory)
    {
        _db = db;
        _storage = storage;
        _httpFactory = httpFactory;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>
    /// Статистика пользователя: часы прослушивания, уникальные треки, топ-артисты, followers/following, avatarUrl
    /// </summary>
    [HttpGet("{id:guid}/stats")]
    public async Task<IActionResult> GetStats(Guid id, [FromQuery] string? avatarKey, CancellationToken ct)
    {
        string? avatarUrl = !string.IsNullOrEmpty(avatarKey)
            ? await _storage.GeneratePresignedImageGetUrlAsync(avatarKey)
            : null;

        var since30 = DateTime.UtcNow.AddDays(-30);

        // Статистика прослушиваний за 30 дней
        var playStats = await _db.PlayEvents
            .Where(pe => pe.UserId == id && pe.StartedAt >= since30)
            .GroupBy(pe => 1)
            .Select(g => new
            {
                TotalMs = g.Sum(x => x.PlayedMs),
                TrackCount = g.Select(x => x.TrackId).Distinct().Count()
            })
            .FirstOrDefaultAsync(ct);

        var totalHours = (playStats?.TotalMs ?? 0) / 3_600_000.0;
        var uniqueTracks = playStats?.TrackCount ?? 0;

        // Топ-3 артиста за 30 дней
        var topArtistsRaw = await _db.PlayEvents
            .Where(pe => pe.UserId == id && pe.StartedAt >= since30 && pe.Track!.ArtistId != null)
            .GroupBy(pe => new { pe.Track!.ArtistId, ArtistName = pe.Track.Artist })
            .OrderByDescending(g => g.Sum(x => x.PlayedMs))
            .Take(3)
            .Select(g => new { g.Key.ArtistId, g.Key.ArtistName })
            .ToListAsync(ct);

        var topArtists = topArtistsRaw
            .Select(x => new UserTopArtistItem(x.ArtistId!.Value, x.ArtistName ?? "Unknown"))
            .ToList();

        // Подписчики (followers) — кто подписан на этого пользователя
        var followersCount = await _db.Follows
            .CountAsync(f => f.TargetType == Models.FollowTargetType.User && f.TargetId == id, ct);

        // Подписки
        var followingCount = await _db.Follows
            .CountAsync(f => f.FollowerUserId == id, ct);

        return Ok(new UserProfileStatsResponse(
            avatarUrl,
            Math.Round(totalHours, 1),
            uniqueTracks,
            topArtists,
            followersCount,
            followingCount
        ));
    }

    /// <summary>
    /// Загрузить аватар текущего пользователя.
    /// </summary>
    [HttpPost("avatar")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> UploadAvatar(IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) return BadRequest("Файл пуст.");
        if (!FileStorageService.IsAllowedImageContentType(file.ContentType))
            return BadRequest($"Недопустимый content-type: {file.ContentType}.");

        var userId = UserId;

        await using var stream = file.OpenReadStream();
        var key = await _storage.UploadImageAsync(
            stream, file.FileName, file.ContentType, file.Length, $"users/{userId}");

        var client = _httpFactory.CreateClient("Identity");
        var syncResp = await client.PutAsJsonAsync($"/users/{userId}/avatar-key",
            new { AvatarKey = key }, ct);

        if (syncResp.IsSuccessStatusCode)
        {
            var old = await syncResp.Content.ReadFromJsonAsync<AvatarKeySyncResponse>(cancellationToken: ct);
            if (old?.OldKey is not null && old.OldKey != key)
            {
                try { await _storage.DeleteImageAsync(old.OldKey); } catch { }
            }
        }

        var url = await _storage.GeneratePresignedImageGetUrlAsync(key);
        return Ok(new { avatarUrl = url });
    }

    /// <summary>
    /// Удалить аватар текущего пользователя
    /// </summary>
    [HttpDelete("avatar")]
    public async Task<IActionResult> DeleteAvatar(CancellationToken ct)
    {
        var userId = UserId;

        var client = _httpFactory.CreateClient("Identity");
        var resp = await client.DeleteAsync($"/users/{userId}/avatar-key", ct);
        if (resp.IsSuccessStatusCode)
        {
            var old = await resp.Content.ReadFromJsonAsync<AvatarKeySyncResponse>(cancellationToken: ct);
            if (old?.OldKey is not null)
            {
                try { await _storage.DeleteImageAsync(old.OldKey); } catch { }
            }
        }

        return NoContent();
    }
}

// DTO
internal record AvatarKeySyncResponse(string? OldKey);

public record UserTopArtistItem(Guid ArtistId, string Name);

public record UserProfileStatsResponse(
    string? AvatarUrl,
    double ListeningHours,
    int UniqueTracksPlayed,
    List<UserTopArtistItem> TopArtists,
    int Followers,
    int Following
);