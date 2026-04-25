using Minio;
using Minio.DataModel.Args;

namespace Music.AudioProcessing.Worker.Storage;

public class AudioStorageService
{
    public const string TracksBucket = "tracks";
    public const string HlsBucket = "tracks-hls";

    private readonly IMinioClient _minio;
    private readonly ILogger<AudioStorageService> _log;

    public AudioStorageService(IMinioClient minio, ILogger<AudioStorageService> log)
    {
        _minio = minio;
        _log = log;
    }

    public Task StreamToAsync(string fileName, Stream destination, CancellationToken ct = default)
    {
        return _minio.GetObjectAsync(new GetObjectArgs()
            .WithBucket(TracksBucket)
            .WithObject(fileName)
            .WithCallbackStream(async (source, innerCt) =>
            {
                await source.CopyToAsync(destination, 81920, innerCt);
            }), ct);
    }

    public async Task<string> UploadTrackObjectAsync(
        Stream content, string desiredFileName, string contentType, long size, CancellationToken ct = default)
    {
        var uniqueFileName = $"{Guid.NewGuid()}-{desiredFileName}";
        await _minio.PutObjectAsync(new PutObjectArgs()
            .WithBucket(TracksBucket)
            .WithObject(uniqueFileName)
            .WithStreamData(content)
            .WithObjectSize(size)
            .WithContentType(contentType), ct);
        return uniqueFileName;
    }

    public async Task DeleteTrackObjectAsync(string fileName, CancellationToken ct = default)
    {
        try
        {
            await _minio.RemoveObjectAsync(
                new RemoveObjectArgs().WithBucket(TracksBucket).WithObject(fileName), ct);
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Не удалось удалить старый объект из bucket'а tracks: {File}", fileName);
        }
    }

    public Task UploadHlsObjectAsync(
        string key, Stream content, string contentType, long size, CancellationToken ct = default)
    {
        return _minio.PutObjectAsync(new PutObjectArgs()
            .WithBucket(HlsBucket)
            .WithObject(key)
            .WithStreamData(content)
            .WithObjectSize(size)
            .WithContentType(contentType), ct);
    }

    /// <summary>
    /// Bucket оба должны существовать; создаёт их BucketInitializer в Music.API
    /// </summary>
    public async Task<bool> BucketsExistAsync(CancellationToken ct = default)
    {
        var tracks = await _minio.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(TracksBucket), ct);
        var hls = await _minio.BucketExistsAsync(
            new BucketExistsArgs().WithBucket(HlsBucket), ct);
        return tracks && hls;
    }
}