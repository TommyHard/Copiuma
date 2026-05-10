using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Identity.API.Models;
using Microsoft.IdentityModel.Tokens;

namespace Identity.API.Services;

public class TokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config) => _config = config;

    /// <summary>
    /// Время жизни access-токена
    /// </summary>
    private TimeSpan AccessTokenLifetime
    {
        get
        {
            var raw = _config["JwtSettings:AccessTokenMinutes"];
            if (int.TryParse(raw, out var min) && min is > 0 and <= 240)
                return TimeSpan.FromMinutes(min);
            return TimeSpan.FromMinutes(15);
        }
    }

    public string CreateToken(User user, Guid sessionId)
    {
        // jti — уникальный идентификатор токена
        var jti = Guid.NewGuid().ToString("N");

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new("DisplayName", user.DisplayName ?? ""),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("email_verified", (user.EmailVerifiedAt is not null).ToString().ToLowerInvariant()),
            new("SessionId", sessionId.ToString()),
            new(JwtRegisteredClaimNames.Jti, jti),
            new(JwtRegisteredClaimNames.Iat,
                DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
                ClaimValueTypes.Integer64)
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["JwtSettings:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var now = DateTime.UtcNow;
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            NotBefore = now,
            IssuedAt = now,
            Expires = now.Add(AccessTokenLifetime),
            SigningCredentials = creds,
            Issuer = _config["JwtSettings:Issuer"],
            Audience = _config["JwtSettings:Audience"]
        };

        var tokenHandler = new JwtSecurityTokenHandler();
        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    /// <summary>
    /// Генерирует криптографически случайный refresh-токен (32 байта -> base64url)
    /// </summary>
    public string GenerateRefreshToken()
    {
        var randomNumber = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }

    /// <summary>
    /// SHA-256 хэш для хранения refresh-токена в БД
    /// Если БД утечёт, восстановить оригинальный невозможно(?)
    /// </summary>
    public static string HashRefreshToken(string token)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes);
    }
}