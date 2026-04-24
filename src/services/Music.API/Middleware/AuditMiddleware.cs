using Microsoft.AspNetCore.Mvc.Controllers;
using Music.API.Data;
using Music.API.Models;
using System.Diagnostics;
using System.Security.Claims;
using System.Text.Json;

namespace Music.API.Middleware;

public class AuditMiddleware
{
    private static readonly HashSet<string> MutatingMethods =
        new(StringComparer.OrdinalIgnoreCase) { "POST", "PUT", "PATCH", "DELETE" };

    private readonly RequestDelegate _next;
    private readonly ILogger<AuditMiddleware> _log;

    public AuditMiddleware(RequestDelegate next, ILogger<AuditMiddleware> log)
    {
        _next = next;
        _log = log;
    }

    public async Task InvokeAsync(HttpContext http)
    {
        var sw = Stopwatch.StartNew();

        try
        {
            await _next(http);
        }
        finally
        {
            sw.Stop();
            await TryWriteAuditAsync(http, sw.ElapsedMilliseconds);
        }
    }

    private async Task TryWriteAuditAsync(HttpContext http, long durationMs)
    {
        var method = http.Request.Method;
        var status = http.Response.StatusCode;

        if (!MutatingMethods.Contains(method) && status < 500) return;

        try
        {
            using var scope = http.RequestServices
                .GetRequiredService<IServiceScopeFactory>()
                .CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            var userIdStr = http.User.FindFirstValue(ClaimTypes.NameIdentifier);
            Guid? userId = Guid.TryParse(userIdStr, out var id) ? id : null;

            var endpoint = http.GetEndpoint();
            var action = endpoint?.Metadata.GetMetadata<ControllerActionDescriptor>() is { } cad
                ? $"{cad.ControllerName}.{cad.ActionName}"
                : $"{method} {http.Request.Path.Value}";

            var meta = new Dictionary<string, object?>
            {
                ["route"] = http.Request.RouteValues.ToDictionary(r => r.Key, r => r.Value?.ToString()),
                ["query"] = http.Request.QueryString.HasValue ? http.Request.QueryString.Value : null
            };

            db.AuditEvents.Add(new AuditEvent
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Action = action,
                Method = method,
                Path = http.Request.Path.Value ?? "/",
                StatusCode = status,
                DurationMs = durationMs,
                IpAddress = http.Connection.RemoteIpAddress?.ToString(),
                UserAgent = http.Request.Headers.UserAgent.ToString(),
                CorrelationId = http.TraceIdentifier,
                Metadata = JsonSerializer.Serialize(meta),
                CreatedAt = DateTime.UtcNow
            });

            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Audit write failed for {Method} {Path}", method, http.Request.Path);
        }
    }
}