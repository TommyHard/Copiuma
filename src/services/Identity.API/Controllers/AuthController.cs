using Identity.API.Data;
using Identity.API.Dtos;
using Identity.API.Models;
using Identity.API.Services;
using Identity.API.Services.Email;
using Identity.API.Services.Security;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using StackExchange.Redis;

namespace Identity.API.Controllers;

[ApiController]
[Route("[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly TokenService _tokenService;
    private readonly IEmailSender _email;
    private readonly AuthLockoutService _lockout;
    private readonly IConfiguration _config;
    private readonly ILogger<AuthController> _log;
    private readonly IConnectionMultiplexer _redis;

    private const int RefreshTokenDays = 30;
    private static readonly TimeSpan VerificationTtl = TimeSpan.FromHours(24);
    private static readonly TimeSpan PasswordResetTtl = TimeSpan.FromHours(1);

    public AuthController(
        AppDbContext db,
        TokenService tokenService,
        IEmailSender email,
        AuthLockoutService lockout,
        IConfiguration config,
        ILogger<AuthController> log,
        IConnectionMultiplexer redis)
    {
        _db = db;
        _tokenService = tokenService;
        _email = email;
        _lockout = lockout;
        _config = config;
        _log = log;
        _redis = redis;
    }

    [HttpPost("register")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || !LooksLikeEmail(request.Email))
            return BadRequest("Некорректный email.");
        if (string.IsNullOrEmpty(request.Password) || request.Password.Length < 8)
            return BadRequest("Пароль слишком короткий.");

        var email = request.Email.Trim().ToLowerInvariant();
        if (await _db.Users.AnyAsync(u => u.Email == email))
            return Conflict("Этот Email уже занят.");

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            DisplayName = request.DisplayName ?? email,
            CreatedAt = DateTime.UtcNow,
            Role = UserRole.User,
            EmailVerifiedAt = null,
            Preferences = new UserPreferences()
        };

        _db.Users.Add(user);
        var (plaintext, hash) = SecureTokenGenerator.Generate();

        _db.EmailVerificationTokens.Add(new EmailVerificationToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.Add(VerificationTtl)
        });

        await _db.SaveChangesAsync();
        await SendVerificationAsync(user.Email, plaintext);

        return Ok(new
        {
            Message = "Письмо с подтверждением email отправлено на " + user.Email + "."
        });
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequest request,
        [FromQuery] string? deviceLabel = null)
    {
        var email = request.Email?.Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(email)) return Unauthorized("Укажите Email и пароль.");

        if (await _lockout.IsLockedAsync(email))
            return StatusCode(StatusCodes.Status423Locked,
                "Учетная запись временно заблокирована на 15 минут.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            await _lockout.RegisterFailureAsync(email);
            return Unauthorized("Неверный Email или пароль.");
        }

        await _lockout.ClearAsync(email);

        // Создаем ID сессии до токенов
        var sessionId = Guid.NewGuid();
        var jwt = _tokenService.CreateToken(user, sessionId);
        var refresh = _tokenService.GenerateRefreshToken();

        _db.RefreshTokens.Add(new RefreshToken
        {
            Id = sessionId,
            UserId = user.Id,
            Token = refresh,
            ExpiryDate = DateTime.UtcNow.AddDays(RefreshTokenDays),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString(),
            UserAgent = Truncate(HttpContext.Request.Headers.UserAgent.ToString(), 512),
            DeviceLabel = Truncate(deviceLabel, 128)
        });

        await _db.SaveChangesAsync();

        // Записываем активную сессию в Redis
        await _redis.GetDatabase().StringSetAsync(
            $"active_session:{sessionId}",
            "1",
            TimeSpan.FromDays(RefreshTokenDays));

        return Ok(new { Token = jwt, RefreshToken = refresh });
    }

    [HttpPost("refresh-token")]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        using var tx = await _db.Database.BeginTransactionAsync();
        var stored = await _db.RefreshTokens
            .Include(r => r.User)
            .FirstOrDefaultAsync(r => r.Token == request.RefreshToken);

        if (stored is null) return Unauthorized("Сессия не найдена.");

        if (stored.IsRevoked)
        {
            // Сносить все сессии - т.е. 1 подключение за раз
            //await RevokeAllForUserAsync(stored.UserId);
            //await _db.SaveChangesAsync();
            //await tx.CommitAsync();
            return Unauthorized("Сессия была отозвана.");
        }

        if (stored.ExpiryDate <= DateTime.UtcNow)
            return Unauthorized("Срок действия сессии истек.");

        stored.IsRevoked = true;
        stored.LastUsedAt = DateTime.UtcNow;

        var newSessionId = Guid.NewGuid();
        var newJwt = _tokenService.CreateToken(stored.User!, newSessionId);
        var newRefresh = _tokenService.GenerateRefreshToken();

        _db.RefreshTokens.Add(new RefreshToken
        {
            Id = newSessionId,
            UserId = stored.UserId,
            Token = newRefresh,
            ExpiryDate = DateTime.UtcNow.AddDays(RefreshTokenDays),
            IpAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? stored.IpAddress,
            UserAgent = Truncate(HttpContext.Request.Headers.UserAgent.ToString(), 512) ?? stored.UserAgent,
            DeviceLabel = stored.DeviceLabel
        });

        // Kill old сессию из Redis и добавляем новую
        var db = _redis.GetDatabase();
        await db.KeyDeleteAsync($"active_session:{stored.Id}");
        await db.StringSetAsync($"active_session:{newSessionId}", "1", TimeSpan.FromDays(RefreshTokenDays));

        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(new { Token = newJwt, RefreshToken = newRefresh });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshTokenRequest request)
    {
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.Token == request.RefreshToken);
        if (token is null) return NoContent();

        token.IsRevoked = true;
        await _db.SaveChangesAsync();

        // Kill сессию в Redis
        await _redis.GetDatabase().KeyDeleteAsync($"active_session:{token.Id}");

        return NoContent();
    }

    [HttpPost("logout-all")]
    public async Task<IActionResult> LogoutAll([FromBody] RefreshTokenRequest request)
    {
        var token = await _db.RefreshTokens.FirstOrDefaultAsync(t => t.Token == request.RefreshToken);
        if (token is null) return Unauthorized();

        await RevokeAllForUserAsync(token.UserId);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Token))
            return BadRequest("Token обязателен.");

        var hash = SecureTokenGenerator.Hash(req.Token);
        var record = await _db.EmailVerificationTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hash);

        if (record is null
            || record.ConsumedAt is not null
            || record.ExpiresAt <= DateTime.UtcNow
            || record.User is null)
        {
            return BadRequest("Недействительный или устаревший токен.");
        }

        record.ConsumedAt = DateTime.UtcNow;
        record.User.EmailVerifiedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new { Message = "Email успешно подтвержден." });
    }

    [HttpPost("resend-verification")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationRequest req)
    {
        var email = req.Email?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
            return AcceptedWithMaskedResponse();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null || user.EmailVerifiedAt is not null)
            return AcceptedWithMaskedResponse();

        var (plaintext, hash) = SecureTokenGenerator.Generate();
        _db.EmailVerificationTokens.Add(new EmailVerificationToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.Add(VerificationTtl)
        });

        await _db.SaveChangesAsync();
        await SendVerificationAsync(user.Email, plaintext);

        return AcceptedWithMaskedResponse();
    }

    [HttpPost("forgot-password")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest req)
    {
        var email = req.Email?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(email))
            return AcceptedWithMaskedResponse();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user is null) return AcceptedWithMaskedResponse();

        var (plaintext, hash) = SecureTokenGenerator.Generate();
        _db.PasswordResetTokens.Add(new PasswordResetToken
        {
            Id = Guid.NewGuid(),
            UserId = user.Id,
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.Add(PasswordResetTtl)
        });

        await _db.SaveChangesAsync();

        var url = BuildPasswordResetUrl(plaintext);
        await _email.SendAsync(EmailTemplates.BuildPasswordReset(user.Email, url));

        return AcceptedWithMaskedResponse();
    }

    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Token))
            return BadRequest("Token обязателен.");
        if (string.IsNullOrEmpty(req.NewPassword) || req.NewPassword.Length < 8)
            return BadRequest("Пароль слишком короткий.");

        var hash = SecureTokenGenerator.Hash(req.Token);
        var record = await _db.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == hash);

        if (record is null
            || record.ConsumedAt is not null
            || record.ExpiresAt <= DateTime.UtcNow
            || record.User is null)
        {
            return BadRequest("Недействительный или устаревший токен.");
        }

        record.ConsumedAt = DateTime.UtcNow;
        record.User.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        record.User.PasswordChangedAt = DateTime.UtcNow;

        await RevokeAllForUserAsync(record.User.Id);
        await _lockout.ClearAsync(record.User.Email);
        await _db.SaveChangesAsync();

        return Ok(new { Message = "Пароль успешно изменен." });
    }

    private async Task RevokeAllForUserAsync(Guid userId)
    {
        var tokens = await _db.RefreshTokens
            .Where(t => t.UserId == userId && !t.IsRevoked)
            .ToListAsync();

        var db = _redis.GetDatabase();
        foreach (var t in tokens)
        {
            t.IsRevoked = true;
            await db.KeyDeleteAsync($"active_session:{t.Id}");
        }
    }

    private async Task SendVerificationAsync(string email, string plaintext)
    {
        var url = BuildVerificationUrl(plaintext);
        try
        {
            await _email.SendAsync(EmailTemplates.BuildVerification(email, url));
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Ошибка при отправке verify-email для {Email}", email);
        }
    }

    private string BuildVerificationUrl(string token)
    {
        var web = _config["Auth:PublicWebBaseUrl"]?.TrimEnd('/') ?? "http://localhost:3000";
        return $"{web}/auth/verify-email?token={Uri.EscapeDataString(token)}";
    }

    private string BuildPasswordResetUrl(string token)
    {
        var web = _config["Auth:PublicWebBaseUrl"]?.TrimEnd('/') ?? "http://localhost:3000";
        return $"{web}/auth/reset-password?token={Uri.EscapeDataString(token)}";
    }

    private IActionResult AcceptedWithMaskedResponse() =>
        Accepted(new { Message = "Если email найден, инструкции отправлены." });

    private static bool LooksLikeEmail(string s)
    {
        s = s.Trim();
        var at = s.IndexOf('@');
        if (at <= 0 || at >= s.Length - 1) return false;
        if (s.Contains(' ')) return false;
        var dot = s.IndexOf('.', at);
        return dot > at + 1;
    }

    private static string? Truncate(string? s, int max) =>
        string.IsNullOrEmpty(s) ? s : (s.Length <= max ? s : s[..max]);
}