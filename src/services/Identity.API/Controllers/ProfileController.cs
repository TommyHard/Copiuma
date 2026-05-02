using Identity.API.Data;
using Identity.API.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Identity.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class ProfileController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProfileController(AppDbContext context)
    {
        _context = context;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        var user = await _context.Users
            .Include(u => u.Preferences)
            .FirstOrDefaultAsync(u => u.Id == UserId);

        if (user is null) return NotFound();

        return Ok(new UserProfileResponse(
            user.Id,
            user.Email,
            user.DisplayName,
            user.Bio,
            user.AvatarKey,
            user.Preferences?.FavoriteGenres ?? Array.Empty<string>(),
            user.Preferences?.Language ?? "ru"));
    }

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var user = await _context.Users
            .Include(u => u.Preferences)
            .FirstOrDefaultAsync(u => u.Id == UserId);

        if (user is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(request.DisplayName))
            user.DisplayName = request.DisplayName.Trim();

        if (request.Bio is not null)
            user.Bio = request.Bio.Trim().Length == 0 ? null : request.Bio.Trim();

        user.Preferences ??= new Models.UserPreferences { UserId = user.Id };
        user.Preferences.FavoriteGenres = request.FavoriteGenres ?? Array.Empty<string>();
        user.Preferences.Language = string.IsNullOrWhiteSpace(request.Language) ? "ru" : request.Language;

        await _context.SaveChangesAsync();

        return Ok(new UserProfileResponse(
            user.Id,
            user.Email,
            user.DisplayName,
            user.Bio,
            user.AvatarKey,
            user.Preferences.FavoriteGenres,
            user.Preferences.Language));
    }

    /// <summary>
    /// Смена пароля. Требует текущий пароль для подтверждения
    /// После смены все активные сессии остаются валидными
    /// </summary>
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CurrentPassword) ||
            string.IsNullOrWhiteSpace(request.NewPassword))
            return BadRequest("Поля не могут быть пустыми.");

        if (request.NewPassword.Length < 8)
            return BadRequest("Новый пароль должен быть не менее 8 символов.");

        if (request.CurrentPassword == request.NewPassword)
            return BadRequest("Новый пароль совпадает с текущим.");

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == UserId);
        if (user is null) return NotFound();

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            return BadRequest("Неверный текущий пароль.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.PasswordChangedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { Message = "Пароль успешно изменён." });
    }
}

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);