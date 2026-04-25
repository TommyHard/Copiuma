using Microsoft.Extensions.Diagnostics.HealthChecks;
using Music.AudioProcessing.Worker.Messaging;

namespace Music.AudioProcessing.Worker.HealthChecks;

public class RabbitMqHealthCheck : IHealthCheck
{
    private readonly RabbitConnection _conn;

    public RabbitMqHealthCheck(RabbitConnection conn) => _conn = conn;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var connection = await _conn.GetOrCreateConnectionAsync(cancellationToken);
            if (!connection.IsOpen)
                return HealthCheckResult.Unhealthy("RabbitMQ connection closed.");

            using var channel = connection.CreateModel();
            return channel.IsOpen
                ? HealthCheckResult.Healthy("RabbitMQ ok.")
                : HealthCheckResult.Unhealthy("RabbitMQ channel could not be opened.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("RabbitMQ unreachable.", ex);
        }
    }
}