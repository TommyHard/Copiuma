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

        user.Preferences ??= new Models.UserPreferences { UserId = user.Id };
        user.Preferences.FavoriteGenres = request.FavoriteGenres ?? Array.Empty<string>();
        user.Preferences.Language = string.IsNullOrWhiteSpace(request.Language) ? "ru" : request.Language;

        await _context.SaveChangesAsync();
        return Ok(new { Message = "Профиль обновлён." });
    }
}
