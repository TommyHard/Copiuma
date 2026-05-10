using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Models;
using System.Security.Claims;
using System.Text.Json;

namespace Music.API.Controllers;

/// <summary>
/// Хранение пользовательских настроек/состояния (тема, размеры сайдбаров,
/// последний играющий трек, очередь и т.п.) для синхронизации между устройствами
///
/// Конкретная схема JSON определяется клиентом — backend хранит "as is"
/// и не пытается интерпретировать содержимое
/// </summary>
[ApiController]
[Authorize]
[Route("user-state")]
public class UserStateController : ControllerBase
{
    private readonly AppDbContext _db;
    public UserStateController(AppDbContext db) => _db = db;

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var row = await _db.UserStates.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == UserId, ct);
        if (row is null)
        {
            return Ok(new { state = (object?)null, version = 0L, updatedAt = (DateTime?)null });
        }

        // Возвращаем state как чистый, чтобы user сразу мог сделать .state.theme
        using var doc = JsonDocument.Parse(row.StateJson);
        return Ok(new
        {
            state = doc.RootElement.Clone(),
            version = row.Version,
            updatedAt = row.UpdatedAt,
        });
    }

    public record PutStateRequest(JsonElement State, long? ExpectedVersion);

    [HttpPut]
    public async Task<IActionResult> Put([FromBody] PutStateRequest req, CancellationToken ct)
    {
        if (req.State.ValueKind != JsonValueKind.Object && req.State.ValueKind != JsonValueKind.Null)
            return BadRequest("state должен быть объектом.");

        var json = req.State.ValueKind == JsonValueKind.Null ? "{}" : req.State.GetRawText();
        if (json.Length > 256 * 1024)
            return BadRequest("Слишком большой стейт (>256KB).");

        var row = await _db.UserStates.FirstOrDefaultAsync(x => x.UserId == UserId, ct);
        if (row is null)
        {
            row = new UserState
            {
                UserId = UserId,
                StateJson = json,
                Version = 1,
                UpdatedAt = DateTime.UtcNow,
            };
            _db.UserStates.Add(row);
        }
        else
        {
            // race-condition
            if (req.ExpectedVersion.HasValue && req.ExpectedVersion.Value != row.Version)
            {
                using var doc = JsonDocument.Parse(row.StateJson);
                return Conflict(new
                {
                    message = "Версия рассинхронизирована, обновите состояние.",
                    state = doc.RootElement.Clone(),
                    version = row.Version,
                    updatedAt = row.UpdatedAt,
                });
            }
            row.StateJson = json;
            row.Version += 1;
            row.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync(ct);
        return Ok(new { version = row.Version, updatedAt = row.UpdatedAt });
    }
}