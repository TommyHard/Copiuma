using Microsoft.Extensions.Diagnostics.HealthChecks;
using Music.AudioProcessing.Worker.Storage;

namespace Music.AudioProcessing.Worker.HealthChecks;

public class MinioHealthCheck : IHealthCheck
{
    private readonly AudioStorageService _storage;

    public MinioHealthCheck(AudioStorageService storage) => _storage = storage;

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var ok = await _storage.BucketsExistAsync(cancellationToken);
            return ok
                ? HealthCheckResult.Healthy("MinIO reachable, buckets ok.")
                : HealthCheckResult.Degraded("MinIO reachable, но один из bucket'ов отсутствует.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("MinIO unreachable.", ex);
        }
    }
}