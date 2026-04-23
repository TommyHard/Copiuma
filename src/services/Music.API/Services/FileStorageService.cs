using Minio;
using Minio.DataModel.Args;

namespace Music.API.Services;

public class FileStorageService
{
    private readonly IMinioClient _minioClient;
    private const string BucketName = "tracks";

    public FileStorageService(IMinioClient minioClient)
    {
        _minioClient = minioClient;
    }

    public async Task<string> UploadFileAsync(Stream fileStream, string fileName, string contentType)
    {
        // Проверяем, существует ли бакет tracks. Если нет - будет.
        var bktExistArgs = new BucketExistsArgs().WithBucket(BucketName);
        bool found = await _minioClient.BucketExistsAsync(bktExistArgs);

        if (!found)
        {
            var mkBktArgs = new MakeBucketArgs().WithBucket(BucketName);
            await _minioClient.MakeBucketAsync(mkBktArgs);
        }

        var uniqueFileName = $"{Guid.NewGuid()}-{fileName}";

        var putObjectArgs = new PutObjectArgs()
            .WithBucket(BucketName)
            .WithObject(uniqueFileName)
            .WithStreamData(fileStream)
            .WithObjectSize(fileStream.Length)
            .WithContentType(contentType);

        await _minioClient.PutObjectAsync(putObjectArgs);

        return uniqueFileName;
    }

    public async Task<Stream> GetFileStreamAsync(string fileName)
    {
        var memoryStream = new MemoryStream();

        var getObjectArgs = new GetObjectArgs()
            .WithBucket(BucketName)
            .WithObject(fileName)
            .WithCallbackStream((stream) =>
            {
                stream.CopyTo(memoryStream);
            });

        await _minioClient.GetObjectAsync(getObjectArgs);

        memoryStream.Position = 0;

        return memoryStream;
    }

    public async Task DeleteFileAsync(string fileName)
    {
        var removeObjectArgs = new RemoveObjectArgs()
            .WithBucket(BucketName)
            .WithObject(fileName);

        await _minioClient.RemoveObjectAsync(removeObjectArgs);
    }
}