using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;

namespace Music.API.Services;

/// <summary>
/// Единый поиск по трекам/артистам/альбомам/публичным плейлистам поверх
/// tsvector'ов
///
/// Плейлисты — без tsvector, ищем ILIKE по Title среди
/// public-плейлистов
/// </summary>
public class SearchService
{
    private readonly AppDbContext _db;

    private const string Language = "russian";

    public SearchService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<SearchResult> SearchAsync(
        string query,
        SearchTypes types,
        SearchFacets facets,
        int takePerType,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query))
            return new SearchResult(
                Array.Empty<SearchTrackItem>(),
                Array.Empty<SearchArtistItem>(),
                Array.Empty<SearchAlbumItem>(),
                Array.Empty<SearchPlaylistItem>());

        takePerType = Math.Clamp(takePerType, 1, 50);

        IReadOnlyList<SearchTrackItem> tracks = types.HasFlag(SearchTypes.Tracks)
            ? await SearchTracksAsync(query, facets, takePerType, ct)
            : Array.Empty<SearchTrackItem>();

        IReadOnlyList<SearchArtistItem> artists = types.HasFlag(SearchTypes.Artists)
            ? await SearchArtistsAsync(query, takePerType, ct)
            : Array.Empty<SearchArtistItem>();

        IReadOnlyList<SearchAlbumItem> albums = types.HasFlag(SearchTypes.Albums)
            ? await SearchAlbumsAsync(query, facets, takePerType, ct)
            : Array.Empty<SearchAlbumItem>();

        IReadOnlyList<SearchPlaylistItem> playlists = types.HasFlag(SearchTypes.Playlists)
            ? await SearchPlaylistsAsync(query, takePerType, ct)
            : Array.Empty<SearchPlaylistItem>();

        return new SearchResult(tracks, artists, albums, playlists);
    }

    private async Task<IReadOnlyList<SearchTrackItem>> SearchTracksAsync(
        string q, SearchFacets f, int take, CancellationToken ct)
    {
        var query = _db.Tracks
            .Where(t => t.SearchVector!.Matches(EF.Functions.WebSearchToTsQuery(Language, q)));

        query = ApplyTrackFacets(query, f);

        return await query
            .Select(t => new SearchTrackItem(
                t.Id,
                t.Title,
                t.Artist,
                t.ArtistId,
                t.AlbumId,
                t.Duration,
                t.Genre,
                t.SearchVector!.Rank(EF.Functions.WebSearchToTsQuery(Language, q))))
            .OrderByDescending(x => x.Rank)
            .Take(take)
            .ToListAsync(ct);
    }

    private IQueryable<Track> ApplyTrackFacets(IQueryable<Track> q, SearchFacets f)
    {
        if (!string.IsNullOrWhiteSpace(f.Genre))
        {
            var g = f.Genre.ToLowerInvariant();
            q = q.Where(t => t.Genre == g);
        }
        if (f.MinDurationMs is int minMs)
        {
            var min = TimeSpan.FromMilliseconds(minMs);
            q = q.Where(t => t.Duration != null && t.Duration >= min);
        }
        if (f.MaxDurationMs is int maxMs)
        {
            var max = TimeSpan.FromMilliseconds(maxMs);
            q = q.Where(t => t.Duration != null && t.Duration <= max);
        }
        if (f.YearFrom is int yFrom)
        {
            q = q.Where(t => t.Album != null
                && t.Album.ReleaseDate != null
                && t.Album.ReleaseDate.Value.Year >= yFrom);
        }
        if (f.YearTo is int yTo)
        {
            q = q.Where(t => t.Album != null
                && t.Album.ReleaseDate != null
                && t.Album.ReleaseDate.Value.Year <= yTo);
        }
        return q;
    }

    private async Task<IReadOnlyList<SearchArtistItem>> SearchArtistsAsync(
        string q, int take, CancellationToken ct)
    {
        return await _db.Artists
            .Where(a => a.SearchVector!.Matches(EF.Functions.WebSearchToTsQuery(Language, q)))
            .Select(a => new SearchArtistItem(
                a.Id,
                a.Name,
                a.AvatarKey,
                a.SearchVector!.Rank(EF.Functions.WebSearchToTsQuery(Language, q))))
            .OrderByDescending(x => x.Rank)
            .Take(take)
            .ToListAsync(ct);
    }

    private async Task<IReadOnlyList<SearchAlbumItem>> SearchAlbumsAsync(
        string q, SearchFacets f, int take, CancellationToken ct)
    {
        var query = _db.Albums
            .Where(a => a.SearchVector!.Matches(EF.Functions.WebSearchToTsQuery(Language, q)));

        if (!string.IsNullOrWhiteSpace(f.Genre))
        {
            var g = f.Genre.ToLowerInvariant();
            query = query.Where(a => a.Genre == g);
        }

        if (f.YearFrom is int yFrom)
            query = query.Where(a => a.ReleaseDate != null && a.ReleaseDate.Value.Year >= yFrom);
        if (f.YearTo is int yTo)
            query = query.Where(a => a.ReleaseDate != null && a.ReleaseDate.Value.Year <= yTo);

        return await query
            .Select(a => new SearchAlbumItem(
                a.Id,
                a.Title,
                a.ArtistId,
                a.Artist!.Name,
                a.ReleaseDate,
                a.CoverKey,
                a.Genre,
                a.SearchVector!.Rank(EF.Functions.WebSearchToTsQuery(Language, q))))
            .OrderByDescending(x => x.Rank)
            .Take(take)
            .ToListAsync(ct);
    }

    private async Task<IReadOnlyList<SearchPlaylistItem>> SearchPlaylistsAsync(
        string q, int take, CancellationToken ct)
    {
        var pattern = $"%{q}%";
        return await _db.Playlists
            .Where(p => p.Visibility == PlaylistVisibility.Public
                        && EF.Functions.ILike(p.Title, pattern))
            .OrderByDescending(p => p.CreatedAt)
            .Take(take)
            .Select(p => new SearchPlaylistItem(
                p.Id,
                p.Title,
                p.CreatedAt,
                p.PlaylistTracks.Count))
            .ToListAsync(ct);
    }
}