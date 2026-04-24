using Minio;
using Minio.DataModel.Args;

namespace Music.API.Services;

public class FileStorageService
{
    private readonly IMinioClient _minioClient;
    public const string BucketName = "tracks";
    public const string ImagesBucket = "images";

    private static readonly HashSet<string> AllowedImageContentTypes =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "image/jpeg", "image/png", "image/webp", "image/gif"
        };

    public FileStorageService(IMinioClient minioClient)
    {
        _minioClient = minioClient;
    }

    public async Task EnsureBucketAsync(string? bucket = null, CancellationToken ct = default)
    {
        var name = bucket ?? BucketName;
        var exists = await _minioClient.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(name), ct);

        if (!exists)
        {
            await _minioClient.MakeBucketAsync(
                new MakeBucketArgs().WithBucket(name), ct);
        }
    }

    public static bool IsAllowedImageContentType(string? contentType) =>
        !string.IsNullOrWhiteSpace(contentType) && AllowedImageContentTypes.Contains(contentType!);

    public async Task<string> UploadImageAsync(
        Stream stream,
        string originalFileName,
        string contentType,
        long size,
        string keyPrefix,
        CancellationToken ct = default)
    {
        if (!IsAllowedImageContentType(contentType))
            throw new ArgumentException($"Недопустимый тип изображения: {contentType}.", nameof(contentType));

        var safe = string.IsNullOrWhiteSpace(originalFileName)
            ? "file"
            : Path.GetFileName(originalFileName);
        var uniqueKey = $"{keyPrefix.TrimEnd('/')}/{Guid.NewGuid()}-{safe}";

        await _minioClient.PutObjectAsync(new PutObjectArgs()
            .WithBucket(ImagesBucket)
            .WithObject(uniqueKey)
            .WithStreamData(stream)
            .WithObjectSize(size)
            .WithContentType(contentType), ct);

        return uniqueKey;
    }

    public Task DeleteImageAsync(string key, CancellationToken ct = default)
    {
        return _minioClient.RemoveObjectAsync(new RemoveObjectArgs()
            .WithBucket(ImagesBucket)
            .WithObject(key), ct);
    }

    public Task<string> GeneratePresignedImageGetUrlAsync(string key, int expirySeconds = 3600)
    {
        return _minioClient.PresignedGetObjectAsync(new PresignedGetObjectArgs()
            .WithBucket(ImagesBucket)
            .WithObject(key)
            .WithExpiry(expirySeconds));
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

    /// <summary>
    /// Проверяет, что объект существует. Нужен, чтобы вернуть 404 клиенту
    /// </summary>
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

    /// <summary>
    /// Подписанный URL для прямой отдачи клиенту, в обход Music.API
    /// </summary>
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
            await storage.EnsureBucketAsync(FileStorageService.BucketName, ct);
            await storage.EnsureBucketAsync(FileStorageService.ImagesBucket, ct);
            _log.LogInformation(
                "Buckets готовы: {Tracks}, {Images}.",
                FileStorageService.BucketName, FileStorageService.ImagesBucket);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Не удалось инициализировать bucket'ы.");
        }
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}