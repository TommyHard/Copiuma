using Microsoft.Extensions.Diagnostics.HealthChecks;
using Minio;
using Minio.DataModel.Args;
using Music.API.Services;

namespace Music.API.HealthChecks;

/// <summary>
/// Observability: readiness-проверка MinIO
///
/// Готового пакета AspNetCore.HealthChecks.Minio - нет
/// Поэтому IMinioClient: BucketExists на основной bucket "tracks".
/// Если bucket существует — Healthy, если нет — Degraded, 
/// если RPC падает — Unhealthy
/// </summary>
public class MinioHealthCheck : IHealthCheck
{
    private readonly IMinioClient _minio;

    public MinioHealthCheck(IMinioClient minio)
    {
        _minio = minio;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var exists = await _minio.BucketExistsAsync(
                new BucketExistsArgs().WithBucket(FileStorageService.BucketName),
                cancellationToken);

            return exists
                ? HealthCheckResult.Healthy(
                    $"MinIO reachable, bucket '{FileStorageService.BucketName}' exists.")
                : HealthCheckResult.Degraded(
                    $"MinIO reachable, but bucket '{FileStorageService.BucketName}' is missing. " +
                    "BucketInitializer создаст при следующем старте.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("MinIO unreachable.", ex);
        }
    }
}