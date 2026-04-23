using Identity.API.Data;
using Identity.API.Dtos;
using Identity.API.Models;
using Identity.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Identity.API.Controllers;

[ApiController]
[Route("[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly TokenService _tokenService;

    public AuthController(AppDbContext context, TokenService tokenService)
    {
        _context = context;
        _tokenService = tokenService;
    }

    private const int RefreshTokenDays = 30;

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !request.Email.Contains('@'))
            return BadRequest("Некорректный email.");

        if (string.IsNullOrEmpty(request.Password) || request.Password.Length < 8)
            return BadRequest("Пароль минимум 8 символов.");

        var email = request.Email.Trim().ToLowerInvariant();

        if (await _context.Users.AnyAsync(u => u.Email == email))
            return Conflict("Пользователь с таким Email уже существует.");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            DisplayName = request.DisplayName ?? email,
            CreatedAt = DateTime.UtcNow,
            Preferences = new UserPreferences()
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok(new { Message = "Регистрация успешна." });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var email = request.Email?.Trim().ToLowerInvariant();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized("Неверный Email или пароль.");

        var jwt = _tokenService.CreateToken(user);
        var refresh = _tokenService.GenerateRefreshToken();

        _context.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = refresh,
            ExpiryDate = DateTime.UtcNow.AddDays(RefreshTokenDays)
        });
        await _context.SaveChangesAsync();

        return Ok(new { Token = jwt, RefreshToken = refresh });
    }

    [HttpPost("refresh-token")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        using var tx = await _context.Database.BeginTransactionAsync();

        var stored = await _context.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Token == request.RefreshToken);

        if (stored is null) return Unauthorized("Токен не существует.");

        if (stored.IsRevoked)
        {
            await RevokeAllForUserAsync(stored.UserId);
            await _context.SaveChangesAsync();
            await tx.CommitAsync();
            return Unauthorized("Токен уже был использован. Все сессии пользователя отозваны.");
        }

        if (stored.ExpiryDate <= DateTime.UtcNow)
            return Unauthorized("Срок действия токена истёк.");

        stored.IsRevoked = true;

        var newJwt = _tokenService.CreateToken(stored.User!);
        var newRefresh = _tokenService.GenerateRefreshToken();

        _context.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = stored.UserId,
            Token = newRefresh,
            ExpiryDate = DateTime.UtcNow.AddDays(RefreshTokenDays)
        });

        await _context.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new { Token = newJwt, RefreshToken = newRefresh });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest request)
    {
        var token = await _context.RefreshTokens.FirstOrDefaultAsync(t => t.Token == request.RefreshToken);
        if (token is null) return NoContent();

        token.IsRevoked = true;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("logout-all")]
    public async Task<IActionResult> LogoutAll([FromBody] RefreshTokenRequest request)
    {
        var token = await _context.RefreshTokens.FirstOrDefaultAsync(t => t.Token == request.RefreshToken);
        if (token is null) return Unauthorized();

        await RevokeAllForUserAsync(token.UserId);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    private async Task RevokeAllForUserAsync(Guid userId)
    {
        var tokens = await _context.RefreshTokens
            .Where(t => t.UserId == userId && !t.IsRevoked)
            .ToListAsync();
        foreach (var t in tokens) t.IsRevoked = true;
    }
}
