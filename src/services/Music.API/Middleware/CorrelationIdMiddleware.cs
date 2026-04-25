using System.Diagnostics;
using Serilog.Context;

namespace Music.API.Middleware;

/// <summary>
/// Observability: сквозной correlation-id для логов и трейсов
///
/// Действия:
///   1. Берём заголовок X-Correlation-Id, если пришёл от клиента/gateway
///   2. Иначе генерируем новый Guid
///   3. Помещаем в HttpContext.TraceIdentifier
///   4. Помещаем в Activity.Baggage
///   5. Помещаем в LogContext (Serilog) — все записи в этом запросе будут с CorrelationId
///   6. Возвращаем заголовок клиенту, чтобы он мог поныть в поддержке
/// </summary>
public class CorrelationIdMiddleware
{
    public const string HeaderName = "X-Correlation-Id";
    public const string LogPropertyName = "CorrelationId";

    private readonly RequestDelegate _next;

    public CorrelationIdMiddleware(RequestDelegate next) => _next = next;

    public async Task InvokeAsync(HttpContext http)
    {
        var correlationId = ResolveOrGenerate(http);

        http.TraceIdentifier = correlationId;
        http.Response.Headers[HeaderName] = correlationId;

        var activity = Activity.Current;
        if (activity is not null)
        {
            activity.SetTag("correlation.id", correlationId);
            activity.AddBaggage("correlation.id", correlationId);
        }

        using (LogContext.PushProperty(LogPropertyName, correlationId))
        {
            await _next(http);
        }
    }

    private static string ResolveOrGenerate(HttpContext http)
    {
        if (http.Request.Headers.TryGetValue(HeaderName, out var values))
        {
            var fromHeader = values.ToString();

            if (!string.IsNullOrWhiteSpace(fromHeader)
                && fromHeader.Length <= 128
                && fromHeader.All(c => char.IsLetterOrDigit(c) || c is '-' or '_'))
            {
                return fromHeader;
            }
        }

        return Guid.NewGuid().ToString("N");
    }
}