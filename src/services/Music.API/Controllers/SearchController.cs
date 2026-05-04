using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Music.API.Dtos;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class SearchController : ControllerBase
{
    private readonly SearchService _search;

    public SearchController(SearchService search)
    {
        _search = search;
    }

    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string q,
        [FromQuery] string? types = null,
        [FromQuery] int take = 10,
        [FromQuery] string? genres = null,
        [FromQuery] int? yearFrom = null,
        [FromQuery] int? yearTo = null,
        [FromQuery] int? minDurationMs = null,
        [FromQuery] int? maxDurationMs = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest("Параметр q обязателен");

        if (yearFrom is int yf && yearTo is int yt && yf > yt)
            return BadRequest("yearFrom должен быть ≤ yearTo");

        if (minDurationMs is int mn && maxDurationMs is int mx && mn > mx)
            return BadRequest("minDurationMs должен быть ≤ maxDurationMs");

        var parsed = ParseTypes(types);
        var facets = new SearchFacets(
            Genres: ParseGenres(genres),
            YearFrom: yearFrom,
            YearTo: yearTo,
            MinDurationMs: minDurationMs,
            MaxDurationMs: maxDurationMs);

        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
        Guid? userId = Guid.TryParse(userIdStr, out var id) ? id : null;

        var result = await _search.SearchAsync(q, parsed, facets, take, userId, ct);
        return Ok(result);
    }

    /// <summary>
    /// CSV-строка "rock,pop,post-punk" -> List. Пустое/null -> null (без фильтра)
    /// </summary>
    private static List<string>? ParseGenres(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return raw
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();
    }

    private static SearchTypes ParseTypes(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return SearchTypes.All;

        var parts = raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var acc = SearchTypes.None;
        foreach (var p in parts)
        {
            acc |= p.ToLowerInvariant() switch
            {
                "track" or "tracks" => SearchTypes.Tracks,
                "artist" or "artists" => SearchTypes.Artists,
                "album" or "albums" => SearchTypes.Albums,
                "playlist" or "playlists" => SearchTypes.Playlists,
                "all" => SearchTypes.All,
                _ => SearchTypes.None
            };
        }
        return acc == SearchTypes.None ? SearchTypes.All : acc;
    }
}