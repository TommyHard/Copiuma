using StackExchange.Redis;

namespace Identity.API.Services.Security;

/// <summary>
/// Хранение: Redis. Два ключа на аккаунт:
///   auth:fail:<email>          — счётчик неудач (TTL 15 мин)
///   auth:lock:<email>          — флаг блокировки (TTL 15 мин)
/// </summary>
public class AuthLockoutService
{
    private const int MaxFailures = 10;
    private static readonly TimeSpan FailureWindow = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    private readonly IConnectionMultiplexer _redis;
    private readonly ILogger<AuthLockoutService> _log;

    public AuthLockoutService(IConnectionMultiplexer redis, ILogger<AuthLockoutService> log)
    {
        _redis = redis;
        _log = log;
    }

    public async Task<bool> IsLockedAsync(string email)
    {
        var key = LockKey(Norm(email));
        return await _redis.GetDatabase().KeyExistsAsync(key);
    }

    public async Task RegisterFailureAsync(string email)
    {
        var db = _redis.GetDatabase();
        var fk = FailKey(Norm(email));

        var count = await db.StringIncrementAsync(fk);
        if (count == 1)
        {
            await db.KeyExpireAsync(fk, FailureWindow);
        }

        if (count >= MaxFailures)
        {
            await db.StringSetAsync(LockKey(Norm(email)), "1", LockoutDuration);
            _log.LogWarning("Account locked due to {Count} failed logins: {Email}", count, email);
        }
    }

    public async Task ClearAsync(string email)
    {
        var db = _redis.GetDatabase();
        var n = Norm(email);
        await db.KeyDeleteAsync(new RedisKey[] { FailKey(n), LockKey(n) });
    }

    private static string Norm(string email) => email.Trim().ToLowerInvariant();
    private static string FailKey(string e) => $"auth:fail:{e}";
    private static string LockKey(string e) => $"auth:lock:{e}";
}