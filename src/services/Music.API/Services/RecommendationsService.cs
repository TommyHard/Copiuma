using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using System.Text.Json;

namespace Music.API.Services;

/// <summary>
/// SQL рекомендации. Три поведения:
///
/// 1 Popular - COUNT PlayEvent за последние 7 дней. Кеш 15 мин
/// 2 Similar — ко-встречаемость: "юзеры, слушавшие X, также слушали Y"
///   Кеш 30 мин на track
/// 3 For-you - треки любимых артистов пользователя, которых он ещё не слушал
///   Fallback на Popular, если истории нет. Кеш 10 мин на юзера
/// </summary>
public class RecommendationsService
{
    private const string VersionKey = "rec:version";
    private const int PopularLookbackDays = 7;
    private const int SimilarLookbackDays = 30;
    private const int ForYouLookbackDays = 30;

    private readonly AppDbContext _db;
    private readonly IDistributedCache _cache;
    private readonly FileStorageService _storage;

    public RecommendationsService(AppDbContext db, IDistributedCache cache, FileStorageService storage)
    {
        _db = db;
        _cache = cache;
        _storage = storage;
    }

    // Popular

    public async Task<IReadOnlyList<TrackRecommendationItem>> GetPopularAsync(
        int take, Guid? userId = null, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 100);
        var raw = await GetPopularRawAsync(take * 3, ct);
        return await FilterAsync(raw, take, userId, ct);
    }

    private async Task<IReadOnlyList<TrackRecommendationItem>> GetPopularRawAsync(
        int take, CancellationToken ct)
    {
        var key = await BuildKeyAsync("popular-raw", take.ToString());
        if (await ReadCacheAsync<List<TrackRecommendationItem>>(key, ct) is { } cached)
            return cached;

        var since = DateTime.UtcNow.AddDays(-PopularLookbackDays);

        var rows = await _db.PlayEvents
            .Where(e => e.StartedAt >= since)
            .GroupBy(e => e.TrackId)
            .Select(g => new { TrackId = g.Key, Plays = g.Count() })
            .OrderByDescending(x => x.Plays)
            .Take(take)
            .Join(_db.Tracks,
                p => p.TrackId, t => t.Id,
                (p, t) => new TrackRecommendationItem(
                    t.Id,
                    t.Title,
                    t.Artist,
                    t.ArtistId,
                    t.AlbumId,
                    p.Plays,
                    t.Duration,
                    t.IsExplicit,
                    false))
            .ToListAsync(ct);

        await WriteCacheAsync(key, rows, TimeSpan.FromMinutes(15), ct);
        return rows;
    }

    // Similar (co-listened)

    public async Task<IReadOnlyList<TrackRecommendationItem>> GetSimilarAsync(
        Guid trackId, int take, Guid? userId = null, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 50);
        var raw = await GetSimilarRawAsync(trackId, take * 3, ct);
        return await FilterAsync(raw, take, userId, ct);
    }

    private async Task<IReadOnlyList<TrackRecommendationItem>> GetSimilarRawAsync(
        Guid trackId, int take, CancellationToken ct)
    {
        var key = await BuildKeyAsync("similar-raw", $"{trackId}:{take}");
        if (await ReadCacheAsync<List<TrackRecommendationItem>>(key, ct) is { } cached)
            return cached;

        var since = DateTime.UtcNow.AddDays(-SimilarLookbackDays);

        // Пользователи, слушавшие этот трек за последние N дней
        var userIds = _db.PlayEvents
            .Where(e => e.TrackId == trackId && e.StartedAt >= since)
            .Select(e => e.UserId)
            .Distinct();

        // Что ещё они слушали (исключая искомый трек) — считаем ко-встречаемость
        // как число уникальных пользователей на трек
        var rows = await _db.PlayEvents
            .Where(e => userIds.Contains(e.UserId)
                        && e.TrackId != trackId
                        && e.StartedAt >= since)
            .GroupBy(e => e.TrackId)
            .Select(g => new { TrackId = g.Key, CoUsers = g.Select(x => x.UserId).Distinct().Count() })
            .OrderByDescending(x => x.CoUsers)
            .Take(take)
            .Join(_db.Tracks,
                p => p.TrackId, t => t.Id,
                (p, t) => new TrackRecommendationItem(
                    t.Id,
                    t.Title,
                    t.Artist,
                    t.ArtistId,
                    t.AlbumId,
                    p.CoUsers,
                    t.Duration,
                    t.IsExplicit,
                    false))
            .ToListAsync(ct);

        await WriteCacheAsync(key, rows, TimeSpan.FromMinutes(30), ct);
        return rows;
    }

    private record Excluded(HashSet<Guid> TrackIds, HashSet<Guid> ArtistIds);

    private async Task<Excluded> GetDislikesAsync(Guid userId, CancellationToken ct)
    {
        var dislikes = await _db.UserDislikes
            .Where(d => d.UserId == userId)
            .Select(d => new { d.TargetType, d.TargetId })
            .ToListAsync(ct);

        var tracks = dislikes
            .Where(d => d.TargetType == DislikeTargetType.Track)
            .Select(d => d.TargetId)
            .ToHashSet();
        var artists = dislikes
            .Where(d => d.TargetType == DislikeTargetType.Artist)
            .Select(d => d.TargetId)
            .ToHashSet();

        // Пробрасываем заблокированных артистов и добавляем в список исключений
        var blockedArtists = await _db.UserBlockedArtists
            .Where(b => b.UserId == userId)
            .Select(b => b.ArtistId)
            .ToListAsync(ct);

        foreach (var ba in blockedArtists)
        {
            artists.Add(ba);
        }

        return new Excluded(tracks, artists);
    }

    private async Task<IReadOnlyList<TrackRecommendationItem>> FilterAsync(
        IReadOnlyList<TrackRecommendationItem> rows,
        int take,
        Guid? userId,
        CancellationToken ct)
    {
        if (userId is null) return rows.Take(take).ToList();

        var ex = await GetDislikesAsync(userId.Value, ct);

        IReadOnlyList<TrackRecommendationItem> filtered = (ex.TrackIds.Count == 0 && ex.ArtistIds.Count == 0)
            ? rows.Take(take).ToList()
            : rows
                .Where(r => !ex.TrackIds.Contains(r.TrackId))
                .Where(r => !r.ArtistId.HasValue || !ex.ArtistIds.Contains(r.ArtistId.Value))
                .Take(take)
                .ToList();

        return await EnrichLikedAsync(filtered, userId.Value, ct);
    }

    /// <summary>
    /// Кеш в RecommendationsService user-agnostic, поэтому IsLikedByMe всегда сидит false
    /// На каждый запрос дочитываем LikedTracks для текущего пользователя и патчим записи
    /// </summary>
    private async Task<IReadOnlyList<TrackRecommendationItem>> EnrichLikedAsync(
        IReadOnlyList<TrackRecommendationItem> rows,
        Guid userId,
        CancellationToken ct)
    {
        if (rows.Count == 0) return rows;

        var ids = rows.Select(r => r.TrackId).ToList();
        var liked = await _db.LikedTracks
            .Where(l => l.UserId == userId && ids.Contains(l.TrackId))
            .Select(l => l.TrackId)
            .ToListAsync(ct);

        if (liked.Count == 0) return rows;

        var likedSet = new HashSet<Guid>(liked);
        return rows
            .Select(r => likedSet.Contains(r.TrackId) ? r with { IsLikedByMe = true } : r)
            .ToList();
    }

    // For-you

    public async Task<IReadOnlyList<TrackRecommendationItem>> GetForYouAsync(
        Guid userId, int take, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 50);
        var key = await BuildKeyAsync("for-you", $"{take}", userId);

        if (await ReadCacheAsync<List<TrackRecommendationItem>>(key, ct) is { } cached)
            return await EnrichLikedAsync(cached, userId, ct);

        var since = DateTime.UtcNow.AddDays(-ForYouLookbackDays);

        // Любимые артисты юзера: из прослушиваний + лайков
        // Score = count прослушиваний + 5 за каждый лайк
        var playsByArtist = _db.PlayEvents
                .Where(e => e.UserId == userId && e.StartedAt >= since)
                .Join(_db.Tracks, e => e.TrackId, t => t.Id, (e, t) => new { t.ArtistId, e.PlayedMs, e.Completed })
                .Where(x => x.ArtistId.HasValue)
                .GroupBy(x => x.ArtistId!.Value)
                .Select(g => new {
                    ArtistId = g.Key,
                    // Штраф -2 очка за скип на первых 2х секундах, иначе +1
                    Score = g.Sum(x => x.PlayedMs < 2000 && !x.Completed ? -2 : 1)
                });

        var likesByArtist = _db.LikedTracks
            .Where(l => l.UserId == userId)
            .Join(_db.Tracks, l => l.TrackId, t => t.Id, (l, t) => t.ArtistId)
            .Where(a => a.HasValue)
            .GroupBy(a => a!.Value)
            .Select(g => new { ArtistId = g.Key, Score = g.Count() * 5 });

        var dislikes = await GetDislikesAsync(userId, ct);

        var topArtists = await playsByArtist
            .Concat(likesByArtist)
            .GroupBy(x => x.ArtistId)
            .Select(g => new { ArtistId = g.Key, Score = g.Sum(x => x.Score) })
            .OrderByDescending(x => x.Score)
            .Take(20)
            .Select(x => x.ArtistId)
            .ToListAsync(ct);

        // Убираем дизлайкнутых артистов из пула "любимых"
        topArtists = topArtists.Where(a => !dislikes.ArtistIds.Contains(a)).Take(10).ToList();

        if (topArtists.Count == 0)
        {
            return await GetPopularAsync(take, userId, ct);
        }

        var knownTrackIds = await _db.PlayEvents
            .Where(e => e.UserId == userId)
            .Select(e => e.TrackId)
            .Union(_db.LikedTracks.Where(l => l.UserId == userId).Select(l => l.TrackId))
            .ToListAsync(ct);

        var knownSet = new HashSet<Guid>(knownTrackIds);

        foreach (var t in dislikes.TrackIds) knownSet.Add(t);

        var popularityTable = _db.PlayEvents
            .Where(e => e.StartedAt >= since)
            .GroupBy(e => e.TrackId)
            .Select(g => new { TrackId = g.Key, Plays = g.Count() });

        var candidates = await _db.Tracks
            .Where(t => t.ArtistId.HasValue && topArtists.Contains(t.ArtistId.Value))
            .GroupJoin(
                popularityTable,
                t => t.Id, p => p.TrackId,
                (t, ps) => new { t, Plays = ps.Sum(x => (int?)x.Plays) ?? 0 })
            .OrderByDescending(x => x.Plays)
            .Take(take * 3)
            .Select(x => new TrackRecommendationItem(
                x.t.Id,
                x.t.Title,
                x.t.Artist,
                x.t.ArtistId,
                x.t.AlbumId,
                x.Plays,
                x.t.Duration,
                x.t.IsExplicit,
                false))
            .ToListAsync(ct);

        var filtered = candidates.Where(c => !knownSet.Contains(c.TrackId)).Take(take).ToList();

        if (filtered.Count == 0)
        {
            return await GetPopularAsync(take, userId, ct);
        }

        await WriteCacheAsync(key, filtered, TimeSpan.FromMinutes(10), ct);
        return await EnrichLikedAsync(filtered, userId, ct);
    }

    // Trending artists

    public async Task<IReadOnlyList<ArtistRecommendationItem>> GetTrendingArtistsAsync(
        int take, Guid? userId = null, CancellationToken ct = default)
    {
        take = Math.Clamp(take, 1, 50);
        var raw = await GetTrendingArtistsRawAsync(take * 3, ct);
        if (userId is null) return raw.Take(take).ToList();

        var dislikes = await GetDislikesAsync(userId.Value, ct);
        if (dislikes.ArtistIds.Count == 0) return raw.Take(take).ToList();

        return raw
            .Where(a => !dislikes.ArtistIds.Contains(a.ArtistId))
            .Take(take)
            .ToList();
    }

    private async Task<IReadOnlyList<ArtistRecommendationItem>> GetTrendingArtistsRawAsync(
        int take, CancellationToken ct)
    {
        var key = await BuildKeyAsync("trending-artists-raw", take.ToString());
        if (await ReadCacheAsync<List<ArtistRecommendationItem>>(key, ct) is { } cached)
            return cached;

        var since = DateTime.UtcNow.AddDays(-PopularLookbackDays);

        var rows = await _db.PlayEvents
            .Where(e => e.StartedAt >= since)
            .Join(_db.Tracks, e => e.TrackId, t => t.Id, (e, t) => t.ArtistId)
            .Where(a => a.HasValue)
            .GroupBy(a => a!.Value)
            .Select(g => new { ArtistId = g.Key, Plays = g.Count() })
            .OrderByDescending(x => x.Plays)
            .Take(take)
            .Join(_db.Artists,
                p => p.ArtistId, a => a.Id,
                (p, a) => new { a.Id, a.Name, p.Plays, a.AvatarKey })
            .ToListAsync(ct);

        var items = new List<ArtistRecommendationItem>(rows.Count);
        foreach (var r in rows)
        {
            var avatarUrl = r.AvatarKey is null
                ? null
                : await _storage.GeneratePresignedImageGetUrlAsync(r.AvatarKey);
            items.Add(new ArtistRecommendationItem(r.Id, r.Name, r.Plays, avatarUrl));
        }

        await WriteCacheAsync(key, items, TimeSpan.FromMinutes(15), ct);
        return items;
    }

    /// <summary>
    /// Добавляет к каждому треку список feat. исполнителей
    /// </summary>
    public async Task<IReadOnlyList<object>> AttachFeaturedArtistsAsync(
        IReadOnlyList<TrackRecommendationItem> items, CancellationToken ct = default)
    {
        if (items.Count == 0) return Array.Empty<object>();

        var ids = items.Select(i => i.TrackId).ToList();
        var rows = await _db.TrackFeaturedArtists
            .Where(fa => ids.Contains(fa.TrackId))
            .OrderBy(fa => fa.TrackId).ThenBy(fa => fa.Position)
            .Select(fa => new { fa.TrackId, fa.Artist!.Id, fa.Artist.Name })
            .ToListAsync(ct);

        var byTrack = rows
            .GroupBy(r => r.TrackId)
            .ToDictionary(g => g.Key, g => g.Select(x => new { x.Id, x.Name }).ToList());

        return items.Select(i => (object)new
        {
            i.TrackId,
            i.Title,
            i.Artist,
            i.ArtistId,
            i.AlbumId,
            i.Score,
            i.Duration,
            i.IsExplicit,
            i.IsLikedByMe,
            FeaturedArtists = byTrack.TryGetValue(i.TrackId, out var f) ? f : new(),
        }).ToList();
    }

    public async Task BumpVersionAsync(CancellationToken ct = default)
    {
        var current = await _cache.GetStringAsync(VersionKey, ct);
        var next = (long.TryParse(current, out var v) ? v : 0) + 1;
        await _cache.SetStringAsync(VersionKey, next.ToString(), ct);
    }

    public async Task BumpUserVersionAsync(Guid userId, CancellationToken ct = default)
    {
        var current = await _cache.GetStringAsync($"rec:version:user:{userId}", ct);
        var next = (long.TryParse(current, out var v) ? v : 0) + 1;
        await _cache.SetStringAsync($"rec:version:user:{userId}", next.ToString(), ct);
    }

    private async Task<string> BuildKeyAsync(string kind, string suffix, Guid? userId = null)
    {
        var globalV = await _cache.GetStringAsync(VersionKey) ?? "0";
        var userV = userId.HasValue ? (await _cache.GetStringAsync($"rec:version:user:{userId}") ?? "0") : "0";
        return $"rec:{kind}:v{globalV}:u{userV}:{suffix}";
    }

    private async Task<T?> ReadCacheAsync<T>(string key, CancellationToken ct) where T : class
    {
        var raw = await _cache.GetStringAsync(key, ct);
        if (string.IsNullOrEmpty(raw)) return null;
        try { return JsonSerializer.Deserialize<T>(raw); }
        catch { return null; }
    }

    private Task WriteCacheAsync<T>(string key, T value, TimeSpan ttl, CancellationToken ct) =>
        _cache.SetStringAsync(
            key,
            JsonSerializer.Serialize(value),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl },
            ct);
}