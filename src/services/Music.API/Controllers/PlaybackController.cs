using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Caching.Distributed;
using Music.API.Dtos;
using Music.API.Hubs;
using System.Security.Claims;
using System.Text.Json;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class PlaybackController : ControllerBase
{
    private readonly IDistributedCache _cache;
    private readonly IHubContext<NotificationHub> _hub;

    public PlaybackController(IDistributedCache cache, IHubContext<NotificationHub> hub)
    {
        _cache = cache;
        _hub = hub;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string UserGroup => $"user-{UserId}";

    [HttpPost("state")]
    public async Task<IActionResult> SaveState([FromBody] PlaybackStateRequest request)
    {
        var state = new PlaybackStateResponse(
            request.TrackId,
            request.PositionSeconds,
            request.IsPlaying,
            DateTime.UtcNow);

        var payload = JsonSerializer.Serialize(state);
        await _cache.SetStringAsync($"playback_state_{UserId}", payload,
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(7) });

        await _hub.Clients.Group(UserGroup).SendAsync("PlaybackStateChanged", state);

        return Ok();
    }

    [HttpGet("state")]
    public async Task<IActionResult> GetState()
    {
        var payload = await _cache.GetStringAsync($"playback_state_{UserId}");
        if (string.IsNullOrEmpty(payload))
            return NotFound(new { Message = "Нет активной сессии воспроизведения." });

        return Content(payload, "application/json");
    }
}
