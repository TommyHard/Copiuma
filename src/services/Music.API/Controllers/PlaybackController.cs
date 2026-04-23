using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;
using Music.API.Dtos;

namespace Music.API.Controllers;

[ApiController]
[Route("[controller]")]
public class PlaybackController : ControllerBase
{
    private readonly IDistributedCache _cache;

    public PlaybackController(IDistributedCache cache)
    {
        _cache = cache;
    }

    [HttpPost("state")]
    public async Task<IActionResult> SaveState([FromBody] PlaybackStateRequest request)
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            return Unauthorized("Пользователь не авторизован");
        }

        var cacheKey = $"playback_state_{userId}";

        var state = new PlaybackStateResponse(
            request.TrackId,
            request.PositionSeconds,
            DateTime.UtcNow
        );

        var cacheOptions = new DistributedCacheEntryOptions()
            .SetAbsoluteExpiration(TimeSpan.FromDays(7));

        await _cache.SetStringAsync(cacheKey, JsonSerializer.Serialize(state), cacheOptions);

        return Ok();
    }

    [HttpGet("state")]
    public async Task<IActionResult> GetState()
    {
        var userIdString = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userIdString) || !Guid.TryParse(userIdString, out var userId))
        {
            return Unauthorized("Пользователь не авторизован");
        }

        var cacheKey = $"playback_state_{userId}";
        var cachedData = await _cache.GetStringAsync(cacheKey);

        if (string.IsNullOrEmpty(cachedData))
        {
            return NotFound(new { Message = "Нет активной сессии воспроизведения" });
        }

        return Content(cachedData, "application/json");
    }
}