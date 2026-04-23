using StackExchange.Redis;
using System.Text.Json;

namespace Music.API.Services;

public class RoomStore
{
    private readonly IConnectionMultiplexer _redis;
    private static readonly TimeSpan Ttl = TimeSpan.FromHours(6);

    public RoomStore(IConnectionMultiplexer redis)
    {
        _redis = redis;
    }

    public record RoomState(
        string RoomId,
        string? DjUserId,
        string? DjName,
        Guid? CurrentTrackId,
        string? CurrentTitle,
        string? CurrentArtist,
        double CurrentPosition,
        bool IsPlaying,
        DateTime LastUpdatedAt);

    private static string Key(string roomId) => $"room:{roomId}";

    public async Task<RoomState?> GetAsync(string roomId)
    {
        var db = _redis.GetDatabase();
        var value = await db.StringGetAsync(Key(roomId));
        return value.HasValue ? JsonSerializer.Deserialize<RoomState>(value!) : null;
    }

    public async Task SetAsync(RoomState state)
    {
        var db = _redis.GetDatabase();
        await db.StringSetAsync(Key(state.RoomId), JsonSerializer.Serialize(state), Ttl);
    }

    public async Task<RoomState> GetOrCreateAsync(string roomId)
    {
        var existing = await GetAsync(roomId);
        if (existing is not null) return existing;

        var fresh = new RoomState(roomId, null, null, null, null, null, 0, false, DateTime.UtcNow);
        await SetAsync(fresh);
        return fresh;
    }

    public async Task DeleteAsync(string roomId)
    {
        var db = _redis.GetDatabase();
        await db.KeyDeleteAsync(Key(roomId));
    }
}
