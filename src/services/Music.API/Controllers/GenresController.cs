using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Models;

namespace Music.API.Controllers;

[ApiController]
[Authorize]
[Route("[controller]")]
public class GenresController : ControllerBase
{
    private readonly AppDbContext _db;

    public GenresController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var genres = await _db.Genres
            .OrderBy(g => g.DisplayName)
            .Select(g => new { g.Id, g.Slug, g.DisplayName })
            .ToListAsync(ct);
        return Ok(genres);
    }

    /// <summary>
    /// Создать жанр
    /// </summary>
    [HttpPost]
    [Authorize(Policy = "AdminOnly")]
    public async Task<IActionResult> Create([FromBody] CreateGenreRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.DisplayName))
            return BadRequest("DisplayName обязателен.");

        var slug = request.Slug?.Trim().ToLowerInvariant()
                   ?? request.DisplayName.Trim().ToLowerInvariant().Replace(' ', '-');

        if (await _db.Genres.AnyAsync(g => g.Slug == slug, ct))
            return Conflict($"Жанр '{slug}' уже существует.");

        var genre = new Genre
        {
            Id = Guid.NewGuid(),
            Slug = slug,
            DisplayName = request.DisplayName.Trim(),
        };

        _db.Genres.Add(genre);
        await _db.SaveChangesAsync(ct);

        return Ok(new { genre.Id, genre.Slug, genre.DisplayName });
    }
}

public class CreateGenreRequest
{
    public string? Slug { get; set; }
    public required string DisplayName { get; set; }
}