using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;

namespace Music.API.Services;

/// <summary>
/// Единый поиск по трекам/артистам/альбомам поверх tsvector'ов,
/// которые есть
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
        int takePerType,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(query))
            return new SearchResult(Array.Empty<SearchTrackItem>(), Array.Empty<SearchArtistItem>(), Array.Empty<SearchAlbumItem>());

        takePerType = Math.Clamp(takePerType, 1, 50);

        IReadOnlyList<SearchTrackItem> tracks = types.HasFlag(SearchTypes.Tracks)
            ? await SearchTracksAsync(query, takePerType, ct)
            : Array.Empty<SearchTrackItem>();

        IReadOnlyList<SearchArtistItem> artists = types.HasFlag(SearchTypes.Artists)
            ? await SearchArtistsAsync(query, takePerType, ct)
            : Array.Empty<SearchArtistItem>();

        IReadOnlyList<SearchAlbumItem> albums = types.HasFlag(SearchTypes.Albums)
            ? await SearchAlbumsAsync(query, takePerType, ct)
            : Array.Empty<SearchAlbumItem>();

        return new SearchResult(tracks, artists, albums);
    }

    private async Task<IReadOnlyList<SearchTrackItem>> SearchTracksAsync(string q, int take, CancellationToken ct)
    {
        return await _db.Tracks
            .Where(t => t.SearchVector!.Matches(EF.Functions.WebSearchToTsQuery(Language, q)))
            .Select(t => new SearchTrackItem(
                t.Id,
                t.Title,
                t.Artist,
                t.ArtistId,
                t.AlbumId,
                t.Duration,
                t.SearchVector!.Rank(EF.Functions.WebSearchToTsQuery(Language, q))))
            .OrderByDescending(x => x.Rank)
            .Take(take)
            .ToListAsync(ct);
    }

    private async Task<IReadOnlyList<SearchArtistItem>> SearchArtistsAsync(string q, int take, CancellationToken ct)
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

    private async Task<IReadOnlyList<SearchAlbumItem>> SearchAlbumsAsync(string q, int take, CancellationToken ct)
    {
        return await _db.Albums
            .Where(a => a.SearchVector!.Matches(EF.Functions.WebSearchToTsQuery(Language, q)))
            .Select(a => new SearchAlbumItem(
                a.Id,
                a.Title,
                a.ArtistId,
                a.Artist!.Name,
                a.ReleaseDate,
                a.CoverKey,
                a.SearchVector!.Rank(EF.Functions.WebSearchToTsQuery(Language, q))))
            .OrderByDescending(x => x.Rank)
            .Take(take)
            .ToListAsync(ct);
    }
}