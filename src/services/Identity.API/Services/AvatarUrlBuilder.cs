namespace Identity.API.Services;

/// <summary>
/// Строит абсолютный URL до изображения в публичном MinIO-бакете "images"
/// </summary>
public class AvatarUrlBuilder
{
    private const string ImagesBucket = "images";

    private readonly string? _publicEndpoint;
    private readonly string? _internalEndpoint;

    public AvatarUrlBuilder(IConfiguration configuration)
    {
        _internalEndpoint = configuration["Minio:Endpoint"];
        _publicEndpoint = configuration["Minio:PublicEndpoint"];
    }

    /// <summary>
    /// Возвращает абсолютный URL до картинки или null, если ключ пустой
    /// </summary>
    public string? BuildOrNull(string? key)
    {
        if (string.IsNullOrWhiteSpace(key)) return null;

        var endpoint = !string.IsNullOrEmpty(_publicEndpoint)
            ? _publicEndpoint
            : _internalEndpoint;

        if (string.IsNullOrEmpty(endpoint))
        {
            // Фолбэк на относительный путь — на случай локальных запусков без MinIO
            return $"/{ImagesBucket}/{key}";
        }

        // Бакет "images" имеет public
        return $"http://{endpoint}/{ImagesBucket}/{key}";
    }
}