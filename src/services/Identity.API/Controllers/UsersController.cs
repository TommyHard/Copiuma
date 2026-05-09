using Identity.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Identity.API.Controllers;

/// <summary>
/// Публичный поиск пользователей. Возвращает минимальный профиль (Id + DisplayName)
/// </summary>
[ApiController]
[Authorize]
[Route("[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<UsersController> _log;

    private const int MinQueryLength = 2;
    private const int MaxResults = 10;

    public UsersController(AppDbContext context, ILogger<UsersController> log)
    {
        _context = context;
        _log = log;
    }

    private Guid CallerId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>
    /// Batch-резолв: список userId -> минимальный профиль.
    /// Для отображения имён в списках друзей/подписок
    /// </summary>
    [HttpGet("batch")]
    public async Task<IActionResult> Batch([FromQuery] string ids, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(ids)) return Ok(Array.Empty<object>());

        var parsed = ids.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(s => Guid.TryParse(s.Trim(), out var g) ? g : (Guid?)null)
            .Where(g => g.HasValue)
            .Select(g => g!.Value)
            .Distinct()
            .Take(50)
            .ToList();

        if (parsed.Count == 0) return Ok(Array.Empty<object>());

        var rows = await _context.Users
            .Where(u => parsed.Contains(u.Id))
            .Select(u => new
            {
                u.Id,
                Name = u.DisplayName ?? u.Email.Substring(0, u.Email.IndexOf("@")),
                u.AvatarKey
            })
            .ToListAsync(ct);

        var results = rows.Select(u => (object)new UserSearchResult(
            u.Id,
            u.Name,
            u.AvatarKey != null ? $"/images/{u.AvatarKey}" : null
        )).ToList();

        return Ok(results);
    }

    /// <summary>
    /// Обновить AvatarKey
    /// </summary>
    [HttpPut("{id:guid}/avatar-key")]
    [AllowAnonymous] // внутренний service-to-service
    public async Task<IActionResult> SetAvatarKey(Guid id, [FromBody] SetAvatarKeyRequest request, CancellationToken ct)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();

        var oldKey = user.AvatarKey;
        user.AvatarKey = request.AvatarKey;
        await _context.SaveChangesAsync(ct);

        return Ok(new { OldKey = oldKey });
    }

    /// <summary>
    /// Удалить AvatarKey
    /// </summary>
    [HttpDelete("{id:guid}/avatar-key")]
    [AllowAnonymous]
    public async Task<IActionResult> DeleteAvatarKey(Guid id, CancellationToken ct)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
        if (user is null) return NotFound();

        var oldKey = user.AvatarKey;
        user.AvatarKey = null;
        await _context.SaveChangesAsync(ct);

        return Ok(new { OldKey = oldKey });
    }

    /// <summary>
    /// Публичный профиль пользователя — возвращает DisplayName, Bio, AvatarKey, FavoriteGenres
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetPublicProfile(Guid id, CancellationToken ct)
    {
        var user = await _context.Users
            .Include(u => u.Preferences)
            .FirstOrDefaultAsync(u => u.Id == id, ct);

        if (user is null) return NotFound();

        return Ok(new PublicUserProfile(
            user.Id,
            user.DisplayName ?? user.Email[..user.Email.IndexOf('@')],
            user.Bio,
            user.AvatarKey,
            user.Preferences?.FavoriteGenres ?? Array.Empty<string>()
        ));
    }

    /// <summary>
    /// Поиск пользователей по отображаемому имени
    /// или по email (точное совпадение)
    /// </summary>
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q, CancellationToken ct)
    {
        q = q?.Trim() ?? string.Empty;

        if (q.Length < MinQueryLength)
            return BadRequest($"Запрос должен содержать не менее {MinQueryLength} символов.");

        var callerId = CallerId;
        bool looksLikeEmail = q.Contains('@');

        IQueryable<UserRow> rowsQuery;
        if (looksLikeEmail)
        {
            var emailNorm = q.ToLowerInvariant();

            rowsQuery = _context.Users
                .Where(u => u.Id != callerId
                         && u.EmailVerifiedAt != null
                         && u.Email.ToLower() == emailNorm)
                .Take(MaxResults)
                .Select(u => new UserRow(
                    u.Id,
                    u.DisplayName ?? u.Email.Substring(0, u.Email.IndexOf("@")),
                    u.AvatarKey
                ));
        }
        else
        {
            rowsQuery = _context.Users
                .Where(u => u.Id != callerId
                         && u.DisplayName != null
                         && EF.Functions.ILike(u.DisplayName, $"%{q}%"))
                .OrderBy(u => u.DisplayName)
                .Take(MaxResults)
                .Select(u => new UserRow(u.Id, u.DisplayName!, u.AvatarKey));
        }

        var rows = await rowsQuery.ToListAsync(ct);
        var results = rows.Select(r => new UserSearchResult(
            r.Id,
            r.DisplayName,
            r.AvatarKey != null ? $"/images/{r.AvatarKey}" : null
        )).ToList();
        return Ok(results);
    }
}

internal record UserRow(Guid Id, string DisplayName, string? AvatarKey);

public record UserSearchResult(Guid Id, string DisplayName, string? AvatarUrl);

public record PublicUserProfile(
    Guid Id,
    string DisplayName,
    string? Bio,
    string? AvatarKey,
    string[] FavoriteGenres
);

public record SetAvatarKeyRequest(string? AvatarKey);