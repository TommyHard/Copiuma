using Microsoft.Extensions.Configuration;
using Minio;
using Minio.ApiEndpoints;
using Minio.DataModel.Args;

namespace Music.API.Services;

public class FileStorageService
{
    private readonly IMinioClient _minioClient;
    private readonly string? _publicEndpoint;
    private readonly string? _internalEndpoint;
    public const string BucketName = "tracks";
    public const string ImagesBucket = "images";

    /// <summary>
    /// Bucket под HLS-варианты (master.m3u8 + index.m3u8 + .ts segments)
    /// Структура ключа: {trackId}/master.m3u8, {trackId}/stream_low/index.m3u8,
    /// {trackId}/stream_low/seg_000.ts
    /// </summary>
    public const string HlsBucket = "tracks-hls";

    private static readonly HashSet<string> AllowedImageContentTypes =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "image/jpeg", "image/png", "image/webp", "image/gif"
        };

    public FileStorageService(IMinioClient minioClient, IConfiguration configuration)
    {
        _minioClient = minioClient;
        _internalEndpoint = configuration["Minio:Endpoint"];
        _publicEndpoint = configuration["Minio:PublicEndpoint"];
    }

    /// <summary>
    /// Заменяет внутренний endpoint (minio:9000) на публичный (localhost:18000) в presigned URL
    /// </summary>
    private string RewriteToPublic(string url)
    {
        if (string.IsNullOrEmpty(_publicEndpoint) || string.IsNullOrEmpty(_internalEndpoint))
            return url;
        return url.Replace(_internalEndpoint, _publicEndpoint);
    }

    public async Task EnsureBucketAsync(string? bucket = null, bool makePublic = false, CancellationToken ct = default)
    {
        var name = bucket ?? BucketName;
        var exists = await _minioClient.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(name), ct);

        if (!exists)
        {
            await _minioClient.MakeBucketAsync(
                new MakeBucketArgs().WithBucket(name), ct);
        }

        if (makePublic)
        {
            string policyJson = $@"{{
            ""Version"": ""2012-10-17"",
            ""Statement"": [
                {{
                    ""Effect"": ""Allow"",
                    ""Principal"": {{ ""AWS"": [""*""] }},
                    ""Action"": [ ""s3:GetObject"" ],
                    ""Resource"": [ ""arn:aws:s3:::{name}/*"" ]
                }}
            ]
        }}";

            await _minioClient.SetPolicyAsync(
                new SetPolicyArgs()
                    .WithBucket(name)
                    .WithPolicy(policyJson), ct);
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
        var endpoint = !string.IsNullOrEmpty(_publicEndpoint) ? _publicEndpoint : _internalEndpoint;
        var url = $"http://{endpoint}/{ImagesBucket}/{key}";

        return Task.FromResult(url);
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
    /// Проверяет, что объект существует. Нужен, чтобы вернуть 404
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
    public async Task<string> GeneratePresignedGetUrlAsync(string fileName, int expirySeconds = 900)
    {
        var url = await _minioClient.PresignedGetObjectAsync(new PresignedGetObjectArgs()
            .WithBucket(BucketName)
            .WithObject(fileName)
            .WithExpiry(expirySeconds));
        return RewriteToPublic(url);
    }

    /// <summary>
    /// Загрузить файл в HLS-bucket. key — полный объектный путь:
    /// "{trackId}/master.m3u8", "{trackId}/stream_low/seg_000.ts"
    /// </summary>
    public async Task UploadHlsObjectAsync(
        string key,
        Stream content,
        string contentType,
        long size,
        CancellationToken ct = default)
    {
        await _minioClient.PutObjectAsync(new PutObjectArgs()
            .WithBucket(HlsBucket)
            .WithObject(key)
            .WithStreamData(content)
            .WithObjectSize(size)
            .WithContentType(contentType), ct);
    }

    public Task StreamHlsToAsync(string key, Stream destination, CancellationToken ct = default)
    {
        return _minioClient.GetObjectAsync(new GetObjectArgs()
            .WithBucket(HlsBucket)
            .WithObject(key)
            .WithCallbackStream(async (source, innerCt) =>
            {
                await source.CopyToAsync(destination, 81920, innerCt);
            }), ct);
    }

    public async Task<(bool Exists, long Size, string ContentType)> StatHlsAsync(
        string key, CancellationToken ct = default)
    {
        try
        {
            var stat = await _minioClient.StatObjectAsync(new StatObjectArgs()
                .WithBucket(HlsBucket)
                .WithObject(key), ct);
            return (true, stat.Size, stat.ContentType);
        }
        catch
        {
            return (false, 0, string.Empty);
        }
    }

    /// <summary>
    /// Удалить весь HLS-вывод трека по префиксу "{trackId}/"
    /// Вызывать при soft-purge / DMCA / переобработке
    /// </summary>
    public async Task DeleteHlsPrefixAsync(string prefix, CancellationToken ct = default)
    {
        var keys = new List<string>();
        var listArgs = new ListObjectsArgs()
            .WithBucket(HlsBucket)
            .WithPrefix(prefix.TrimEnd('/') + "/")
            .WithRecursive(true);

        var tcs = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var observable = _minioClient.ListObjectsAsync(listArgs, ct);
        using var sub = observable.Subscribe(
            item => keys.Add(item.Key),
            ex => tcs.TrySetException(ex),
            () => tcs.TrySetResult(true));
        await tcs.Task;

        foreach (var key in keys)
        {
            await _minioClient.RemoveObjectAsync(
                new RemoveObjectArgs().WithBucket(HlsBucket).WithObject(key), ct);
        }
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

            await storage.EnsureBucketAsync(FileStorageService.BucketName, false, ct);
            await storage.EnsureBucketAsync(FileStorageService.HlsBucket, false, ct);

            // PUBLIC
            await storage.EnsureBucketAsync(FileStorageService.ImagesBucket, true, ct);

            _log.LogInformation(
                "Buckets готовы: {Tracks}, {Images} (Public), {Hls}.",
                FileStorageService.BucketName,
                FileStorageService.ImagesBucket,
                FileStorageService.HlsBucket);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Не удалось инициализировать bucket'ы.");
        }
    }

    public Task StopAsync(CancellationToken ct) => Task.CompletedTask;
}