using Identity.API.Data;
using Identity.API.Dtos;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Identity.API.Controllers;

[ApiController]
[Route("[controller]")]
public class ProfileController : ControllerBase
{
    private readonly AppDbContext _context;

    public ProfileController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetProfile()
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            return Unauthorized("Пользователь не идентифицирован");
        }

        var user = await _context.Users
            .Include(u => u.Preferences)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null) return NotFound("Пользователь не найден");

        var response = new UserProfileResponse(
            user.Id,
            user.Email,
            user.DisplayName,
            user.Preferences?.FavoriteGenres ?? Array.Empty<string>(),
            user.Preferences?.Language ?? "ru"
        );

        return Ok(response);
    }

    [HttpPut]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request)
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            return Unauthorized();
        }

        var user = await _context.Users
            .Include(u => u.Preferences)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null) return NotFound();

        user.DisplayName = request.DisplayName;

        if (user.Preferences == null)
        {
            user.Preferences = new Models.UserPreferences { UserId = user.Id };
        }

        user.Preferences.FavoriteGenres = request.FavoriteGenres;
        user.Preferences.Language = request.Language;

        await _context.SaveChangesAsync();

        return Ok("Профиль успешно обновлен");
    }
}