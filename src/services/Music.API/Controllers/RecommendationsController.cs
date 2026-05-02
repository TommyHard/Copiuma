using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class RecommendationsController : ControllerBase
{
    private readonly RecommendationsService _rec;

    public RecommendationsController(RecommendationsService rec)
    {
        _rec = rec;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    /// <summary>
    /// Самые проигрываемые треки за последние 7 дней
    /// Дизлайки учитываются
    /// </summary>
    [HttpGet("popular")]
    public async Task<IActionResult> Popular([FromQuery] int take = 50, CancellationToken ct = default)
    {
        var items = await _rec.GetPopularAsync(take, UserId, ct);
        return Ok(await _rec.AttachFeaturedArtistsAsync(items, ct));
    }

    /// <summary>
    /// Ко-слушанные треки
    /// Дизлайки учитываются
    /// </summary>
    [HttpGet("similar/{trackId:guid}")]
    public async Task<IActionResult> Similar(Guid trackId, [FromQuery] int take = 20, CancellationToken ct = default)
    {
        var items = await _rec.GetSimilarAsync(trackId, take, UserId, ct);
        return Ok(await _rec.AttachFeaturedArtistsAsync(items, ct));
    }

    /// <summary>
    /// Персональные рекомендации: по артистам, которых юзер слушает/лайкает
    /// Дизлайки учитываются
    /// </summary>
    [HttpGet("for-you")]
    public async Task<IActionResult> ForYou([FromQuery] int take = 20, CancellationToken ct = default)
    {
        var items = await _rec.GetForYouAsync(UserId, take, ct);
        return Ok(await _rec.AttachFeaturedArtistsAsync(items, ct));
    }

    /// <summary>
    /// Популярные артисты за последние 7 дней
    /// Дизлайкнутые артисты скрываются
    /// </summary>
    [HttpGet("artists/trending")]
    public async Task<IActionResult> TrendingArtists([FromQuery] int take = 20, CancellationToken ct = default)
        => Ok(await _rec.GetTrendingArtistsAsync(take, UserId, ct));
}