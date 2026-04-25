using System.Security.Cryptography;

namespace Identity.API.Services.Security;

/// <summary>
/// Auth-hardening: создание plaintext-токенов и их хэширование под хранение в БД
///
/// Токен — 32 случайных байта в base64url (43 символа без padding)
/// </summary>
public static class SecureTokenGenerator
{
    /// <summary>
    /// Возвращает (plaintext, sha256-hex)
    /// </summary>
    public static (string Plaintext, string Hash) Generate()
    {
        Span<byte> raw = stackalloc byte[32];
        RandomNumberGenerator.Fill(raw);

        var plaintext = Convert.ToBase64String(raw)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');

        return (plaintext, Hash(plaintext));
    }

    public static string Hash(string plaintext)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(plaintext);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }
}