using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Dtos;
using Music.API.Models;
using Music.API.Services;
using System.Security.Claims;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
public class ReviewsController : ControllerBase
{
    private const int MaxReviewLength = 4000;
    private const int MinReviewLength = 1;

    private readonly AppDbContext _db;
    private readonly NotificationService _notify;

    public ReviewsController(AppDbContext db, NotificationService notify)
    {
        _db = db;
        _notify = notify;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string? UserName => User.FindFirstValue("DisplayName");

    // ---- Create / read list per track ----

    [HttpPost("tracks/{trackId:guid}/reviews")]
    public async Task<IActionResult> Create(Guid trackId, [FromBody] CreateReviewRequest request)
    {
        var text = (request.Text ?? string.Empty).Trim();
        if (text.Length < MinReviewLength) return BadRequest("Текст отзыва не может быть пустым.");
        if (text.Length > MaxReviewLength) return BadRequest($"Максимум {MaxReviewLength} символов.");

        var track = await _db.Tracks.FirstOrDefaultAsync(t => t.Id == trackId);
        if (track is null) return NotFound("Трек не найден.");

        var review = new TrackReview
        {
            Id = Guid.NewGuid(),
            TrackId = trackId,
            AuthorId = UserId,
            Text = text,
            CreatedAt = DateTime.UtcNow
        };

        _db.TrackReviews.Add(review);
        await _db.SaveChangesAsync();

        if (track.UploadedByUserId != UserId)
        {
            await _notify.CreateAsync(track.UploadedByUserId, NotificationTypes.TrackReviewCreated, new
            {
                trackId,
                trackTitle = track.Title,
                reviewId = review.Id,
                authorId = UserId,
                authorName = UserName,
                excerpt = text.Length > 140 ? text[..140] + "…" : text
            });
        }

        return Ok(ToResponse(review, likeCount: 0, likedByMe: false));
    }

    [HttpGet("tracks/{trackId:guid}/reviews")]
    public async Task<IActionResult> List(
        Guid trackId,
        [FromQuery] int skip = 0,
        [FromQuery] int take = 20,
        [FromQuery] string sort = "new")
    {
        if (skip < 0) skip = 0;
        take = Math.Clamp(take, 1, 100);

        if (!await _db.Tracks.AnyAsync(t => t.Id == trackId))
            return NotFound("Трек не найден.");

        var baseQuery = _db.TrackReviews
            .Where(r => r.TrackId == trackId && !r.IsDeleted);

        var projected = baseQuery.Select(r => new
        {
            Review = r,
            LikeCount = _db.ReviewLikes.Count(l => l.ReviewId == r.Id),
            LikedByMe = _db.ReviewLikes.Any(l => l.ReviewId == r.Id && l.UserId == UserId)
        });

        projected = sort.ToLowerInvariant() switch
        {
            "top" => projected.OrderByDescending(x => x.LikeCount).ThenByDescending(x => x.Review.CreatedAt),
            _ => projected.OrderByDescending(x => x.Review.CreatedAt),
        };

        var page = await projected.Skip(skip).Take(take).ToListAsync();

        var items = page
            .Select(x => ToResponse(x.Review, x.LikeCount, x.LikedByMe))
            .ToList();

        return Ok(new { total = await baseQuery.CountAsync(), items });
    }

    // ---- Edit own review ----

    [HttpPut("reviews/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReviewRequest request)
    {
        var text = (request.Text ?? string.Empty).Trim();
        if (text.Length < MinReviewLength) return BadRequest("Текст отзыва не может быть пустым.");
        if (text.Length > MaxReviewLength) return BadRequest($"Максимум {MaxReviewLength} символов.");

        var review = await _db.TrackReviews.FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);
        if (review is null) return NotFound();
        if (review.AuthorId != UserId) return Forbid();

        review.Text = text;
        review.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var likeCount = await _db.ReviewLikes.CountAsync(l => l.ReviewId == id);
        var likedByMe = await _db.ReviewLikes.AnyAsync(l => l.ReviewId == id && l.UserId == UserId);

        return Ok(ToResponse(review, likeCount, likedByMe));
    }

    [HttpDelete("reviews/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var review = await _db.TrackReviews.FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);
        if (review is null) return NotFound();
        if (review.AuthorId != UserId) return Forbid();

        review.IsDeleted = true;
        review.UpdatedAt = DateTime.UtcNow;
        review.Text = string.Empty;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ---- Likes ----

    [HttpPost("reviews/{id:guid}/like")]
    public async Task<IActionResult> Like(Guid id)
    {
        var review = await _db.TrackReviews.FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted);
        if (review is null) return NotFound();

        var exists = await _db.ReviewLikes.AnyAsync(l => l.ReviewId == id && l.UserId == UserId);
        if (exists) return Conflict("Уже лайкнули.");

        _db.ReviewLikes.Add(new ReviewLike
        {
            ReviewId = id,
            UserId = UserId,
            CreatedAt = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();

        if (review.AuthorId != UserId)
        {
            await _notify.CreateAsync(review.AuthorId, NotificationTypes.ReviewLiked, new
            {
                reviewId = id,
                trackId = review.TrackId,
                likerId = UserId,
                likerName = UserName
            });
        }

        var likeCount = await _db.ReviewLikes.CountAsync(l => l.ReviewId == id);
        return Ok(new { likeCount, likedByMe = true });
    }

    [HttpDelete("reviews/{id:guid}/like")]
    public async Task<IActionResult> Unlike(Guid id)
    {
        var like = await _db.ReviewLikes
            .FirstOrDefaultAsync(l => l.ReviewId == id && l.UserId == UserId);
        if (like is null) return NotFound();

        _db.ReviewLikes.Remove(like);
        await _db.SaveChangesAsync();

        var likeCount = await _db.ReviewLikes.CountAsync(l => l.ReviewId == id);
        return Ok(new { likeCount, likedByMe = false });
    }

    private static ReviewResponse ToResponse(TrackReview r, int likeCount, bool likedByMe) =>
        new(r.Id, r.TrackId, r.AuthorId, r.Text, likeCount, likedByMe, r.CreatedAt, r.UpdatedAt);
}
