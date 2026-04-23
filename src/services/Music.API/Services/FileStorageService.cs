using Minio;
using Minio.DataModel.Args;

namespace Music.API.Services;

public class FileStorageService
{
    private readonly IMinioClient _minioClient;
    public const string BucketName = "tracks";

    public FileStorageService(IMinioClient minioClient)
    {
        _minioClient = minioClient;
    }

    public async Task EnsureBucketAsync(CancellationToken ct = default)
    {
        var exists = await _minioClient.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(BucketName), ct);

        if (!exists)
        {
            await _minioClient.MakeBucketAsync(
                new MakeBucketArgs().WithBucket(BucketName), ct);
        }
    }

    public async Task<string> UploadFileAsync(
        Stream fileStream,
        string fileName,
        string contentType,
        long size,
        CancellationToken ct = default)
    {
        var uniqueFileName = $"{Guid.NewGuid()}-{fileName}";

        await _minioClient.PutObjectAsync(new PutObjectArgs()
            .WithBucket(BucketName)
            .WithObject(uniqueFileName)
            .WithStreamData(fileStream)
            .WithObjectSize(size)
            .WithContentType(contentType), ct);

        return uniqueFileName;
    }

    public Task StreamToAsync(string fileName, Stream destination, CancellationToken ct = default)
    {
        return _minioClient.GetObjectAsync(new GetObjectArgs()
            .WithBucket(BucketName)
            .WithObject(fileName)
            .WithCallbackStream(async (source, innerCt) =>
            {
                await source.CopyToAsync(destination, 81920, innerCt);
            }), ct);
    }

    public async Task<(bool Exists, long Size, string ContentType)> StatAsync(
        string fileName, CancellationToken ct = default)
    {
        try
        {
            var stat = await _minioClient.StatObjectAsync(new StatObjectArgs()
                .WithBucket(BucketName)
                .WithObject(fileName), ct);
            return (true, stat.Size, stat.ContentType);
        }
        catch
        {
            return (false, 0, string.Empty);
        }
    }

    public Task DeleteFileAsync(string fileName, CancellationToken ct = default)
    {
        return _minioClient.RemoveObjectAsync(new RemoveObjectArgs()
            .WithBucket(BucketName)
            .WithObject(fileName), ct);
    }

    public Task<string> GeneratePresignedGetUrlAsync(string fileName, int expirySeconds = 900)
    {
        return _minioClient.PresignedGetObjectAsync(new PresignedGetObjectArgs()
            .WithBucket(BucketName)
            .WithObject(fileName)
            .WithExpiry(expirySeconds));
    }
}

public class BucketInitializer : IHostedService
{
    private readonly IServiceProvider _sp;
    private readonly ILogger<BucketInitializer> _log;

    public BucketInitializer(IServiceProvider sp, ILogger<BucketInitializer> log)
    {
        _sp = sp;
        _log = log;
    }

    public async Task StartAsync(CancellationToken ct)
    {
        try
        {
            using var scope = _sp.CreateScope();
            var storage = scope.ServiceProvider.GetRequiredService<FileStorageService>();
            await storage.EnsureBucketAsync(ct);
            _log.LogInformation("Bucket {Bucket} готов.", FileStorageService.BucketName);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Не удалось инициализировать bucket.");
        }
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}
