using Identity.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Identity.API.Controllers;

/// <summary>
/// Поиск пользователей. Возвращает мин. профиль (Id + DisplayName)
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
    /// Поиск пользователей по отображаемому имени
    /// или по email (только точное совпадение)
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