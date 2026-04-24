using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Music.API.Dtos;
using Music.API.Services;

namespace Music.API.Controllers;

/// <summary>
/// Единый поиск /search?q=. Раньше были три разных эндпойнта
/// (/tracks/search, /artists?q=, /albums?q=). Старые остаются
/// совместимости ради. Удалить в будущем
/// </summary>
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
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(q))
            return BadRequest("Параметр q обязателен.");

        var parsed = ParseTypes(types);
        var result = await _search.SearchAsync(q, parsed, take, ct);
        return Ok(result);
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
                "all" => SearchTypes.All,
                _ => SearchTypes.None
            };
        }

        return acc == SearchTypes.None ? SearchTypes.All : acc;
    }
}