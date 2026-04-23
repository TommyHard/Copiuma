using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using System.Security.Claims;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("tracks/{trackId:guid}/rating")]
public class RatingsController : ControllerBase
{
    private readonly AppDbContext _db;

    public RatingsController(AppDbContext db)
    {
        _db = db;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpPut]
    public async Task<IActionResult> Rate(Guid trackId, [FromBody] RateTrackRequest request)
    {
        if (request.Value < 1 || request.Value > 5)
            return BadRequest("Оценка должна быть от 1 до 5.");

        if (!await _db.Tracks.AnyAsync(t => t.Id == trackId))
            return NotFound("Трек не найден.");

        var existing = await _db.TrackRatings
            .FirstOrDefaultAsync(r => r.UserId == UserId && r.TrackId == trackId);

        if (existing is null)
        {
            _db.TrackRatings.Add(new TrackRating
            {
                UserId = UserId,
                TrackId = trackId,
                Value = request.Value
            });
        }
        else
        {
            existing.Value = request.Value;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(await BuildStatsAsync(trackId));
    }

    [HttpDelete]
    public async Task<IActionResult> Remove(Guid trackId)
    {
        var existing = await _db.TrackRatings
            .FirstOrDefaultAsync(r => r.UserId == UserId && r.TrackId == trackId);
        if (existing is null) return NotFound();

        _db.TrackRatings.Remove(existing);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet]
    public async Task<IActionResult> Get(Guid trackId)
    {
        if (!await _db.Tracks.AnyAsync(t => t.Id == trackId))
            return NotFound("Трек не найден.");

        return Ok(await BuildStatsAsync(trackId));
    }

    private async Task<TrackRatingResponse> BuildStatsAsync(Guid trackId)
    {
        var grouped = await _db.TrackRatings
            .Where(r => r.TrackId == trackId)
            .GroupBy(r => r.Value)
            .Select(g => new { Value = g.Key, Count = g.Count() })
            .ToListAsync();

        var dist = new int[5];
        var total = 0;
        var sum = 0;
        foreach (var g in grouped)
        {
            if (g.Value >= 1 && g.Value <= 5) dist[g.Value - 1] = g.Count;
            total += g.Count;
            sum += g.Value * g.Count;
        }

        var average = total == 0 ? 0d : Math.Round((double)sum / total, 2);

        int? yours = await _db.TrackRatings
            .Where(r => r.TrackId == trackId && r.UserId == UserId)
            .Select(r => (int?)r.Value)
            .FirstOrDefaultAsync();

        return new TrackRatingResponse(trackId, yours, average, total, dist);
    }
}