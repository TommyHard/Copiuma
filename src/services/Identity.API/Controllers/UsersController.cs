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

        var results = await _context.Users
            .Where(u => parsed.Contains(u.Id))
            .Select(u => (object)new UserSearchResult(
                u.Id,
                u.DisplayName ?? u.Email.Substring(0, u.Email.IndexOf("@"))
            ))
            .ToListAsync(ct);

        return Ok(results);
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

        IQueryable<object> query;

        if (looksLikeEmail)
        {
            var emailNorm = q.ToLowerInvariant();

            query = _context.Users
                .Where(u => u.Id != callerId
                         && u.EmailVerifiedAt != null
                         && u.Email.ToLower() == emailNorm)
                .Take(MaxResults)
                .Select(u => (object)new UserSearchResult(
                    u.Id,
                    u.DisplayName ?? u.Email.Substring(0, u.Email.IndexOf("@"))
                ));
        }
        else
        {
            query = _context.Users
                .Where(u => u.Id != callerId
                         && u.DisplayName != null
                         && EF.Functions.ILike(u.DisplayName, $"%{q}%"))
                .OrderBy(u => u.DisplayName)
                .Take(MaxResults)
                .Select(u => (object)new UserSearchResult(u.Id, u.DisplayName!));
        }

        var results = await query.ToListAsync(ct);
        return Ok(results);
    }
}

public record UserSearchResult(Guid Id, string DisplayName);