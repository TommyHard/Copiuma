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

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
        {
            return BadRequest("Пользователь с таким Email уже существует");
        }

        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = request.Email,
            PasswordHash = passwordHash,
            DisplayName = request.DisplayName ?? request.Email,
            CreatedAt = DateTime.UtcNow,
            Preferences = new UserPreferences()
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok("Регистрация успешна!");
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == request.Email);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized("Неверный Email или пароль");
        }

        var jwtToken = _tokenService.CreateToken(user);
        var refreshToken = _tokenService.GenerateRefreshToken();

        _context.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            Token = refreshToken,
            ExpiryDate = DateTime.UtcNow.AddDays(30)
        });

        await _context.SaveChangesAsync();

        return Ok(new { Token = jwtToken, RefreshToken = refreshToken });
    }

    [HttpPost("refresh-token")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var storedToken = await _context.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Token == request.RefreshToken);

        if (storedToken == null) return Unauthorized("Токен не существует");
        if (storedToken.IsRevoked) return Unauthorized("Токен был отозван");
        if (storedToken.ExpiryDate <= DateTime.UtcNow) return Unauthorized("Срок действия токена истек");

        storedToken.IsRevoked = true;

        var newJwtToken = _tokenService.CreateToken(storedToken.User!);
        var newRefreshToken = _tokenService.GenerateRefreshToken();

        _context.RefreshTokens.Add(new RefreshToken
        {
            Id = Guid.NewGuid(),
            UserId = storedToken.UserId,
            Token = newRefreshToken,
            ExpiryDate = DateTime.UtcNow.AddDays(30)
        });

        await _context.SaveChangesAsync();

        return Ok(new { Token = newJwtToken, RefreshToken = newRefreshToken });
    }
}