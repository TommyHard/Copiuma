using Identity.API.Data;
using Identity.API.Dtos;
using Identity.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Net;
using System.Security.Claims;

namespace Identity.API.Controllers;

[ApiController]
[Route("me")]
[Authorize]
public class MeController : ControllerBase
{
    private readonly AppDbContext _db;

    public MeController(AppDbContext db) => _db = db;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var u = await _db.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == UserId, ct);
        if (u is null) return NotFound();

        string? avatarUrl = u.AvatarKey != null ? $"/images/{u.AvatarKey}" : null;

        return Ok(new MeResponse(
            u.Id, 
            u.Email, 
            u.DisplayName, 
            u.Role, 
            u.EmailVerifiedAt is not null, 
            u.CreatedAt,
            avatarUrl
            ));
    }

    [HttpPost("become-artist")]
    public async Task<IActionResult> BecomeArtist([FromBody] BecomeArtistRequest req, CancellationToken ct)
    {
        var u = await _db.Users.FirstOrDefaultAsync(x => x.Id == UserId, ct);
        if (u is null) return NotFound();
        if (u.EmailVerifiedAt is null)
            return Conflict("Сначала подтверди email.");
        if (u.Role >= UserRole.Artist)
            return Ok(new { Message = "Роль уже выдана.", Role = u.Role.ToString() });

        u.Role = UserRole.Artist;

        if (!string.IsNullOrWhiteSpace(req.StageName))
            u.DisplayName = req.StageName.Trim();

        await _db.SaveChangesAsync(ct);

        return Ok(new
        {
            Message = "Поздравляем, теперь вы артист. Перезайдите, чтобы получить новый JWT с ролью.",
            Role = u.Role.ToString()
        });
    }
}