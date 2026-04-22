using NpgsqlTypes;

namespace Music.API.Models;

public class Track
{
    public Guid Id { get; set; }

    // Название трека
    public required string Title { get; set; }

    // Исполнитель
    public string? Artist { get; set; }

    // Уникальное имя файла в MinIO
    public required string FileName { get; set; }

    // Тип файла
    public required string ContentType { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    // ID пользователя, который загрузил трек
    public Guid UploadedByUserId { get; set; }

    public TimeSpan? Duration { get; set; }

    public NpgsqlTsVector? SearchVector { get; set; }
}