using Music.Shared.Contracts.Audio;
using NpgsqlTypes;

namespace Music.API.Models;

public class Track
{
    public Guid Id { get; set; }

    public required string Title { get; set; }

    /// <summary>
    /// Снимок имени исполнителя. Если задан ArtistId, копируется из Artist.Name
    /// при upload, иначе берётся из запроса как есть
    /// </summary>
    public string? Artist { get; set; }

    public required string FileName { get; set; }

    public required string ContentType { get; set; }

    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    public Guid UploadedByUserId { get; set; }

    public TimeSpan? Duration { get; set; }

    /// <summary>
    /// Ссылка на сущность Artist. null = legacy/без каталога
    /// </summary>
    public Guid? ArtistId { get; set; }
    public Artist? ArtistEntity { get; set; }

    /// <summary>
    /// Необязательно: к какому альбому относится. null = сингл
    /// </summary>
    public Guid? AlbumId { get; set; }
    public Album? Album { get; set; }

    /// <summary>
    /// Номер трека в альбоме. null если нет альбома
    /// </summary>
    public int? TrackNumber { get; set; }

    /// <summary>
    /// Собственная обложка трека
    /// null = трек наследует обложку альбома (если есть AlbumId), иначе обложки нет
    /// </summary>
    public string? CoverKey { get; set; }

    public List<string> Genres { get; set; } = new();

    public List<TrackGenre> TrackGenres { get; set; } = new();

    /// <summary>
    /// Доп. исполнители
    /// </summary>
    public List<TrackFeaturedArtist> FeaturedArtists { get; set; } = new();

    /// <summary>
    /// Explicit-контент (мат / 18+)
    /// </summary>
    public bool IsExplicit { get; set; }

    /// <summary>
    /// Soft-delete: вместо физического удаления ставим timestamp
    /// Запись остаётся для аудита, но скрывается из всех user-facing выборок
    /// Фоновый job раз в N дней чистит файлы в MinIO и физически удаляет запись
    /// </summary>
    public DateTime? DeletedAt { get; set; }

    /// <summary>
    /// Причина удаления (DMCA / moderator / self). null — если ещё активен
    /// </summary>
    public TrackDeletionReason? DeletionReason { get; set; }

    /// <summary>
    /// Состояние фоновой обработки (ffmpeg -> duration/loudness/waveform)
    /// Upload создаёт трек со статусом Pending; worker (теперь — отдельный сервис)
    /// меняет на Ready/Failed.
    /// </summary>
    public TrackProcessingStatus ProcessingStatus { get; set; } = TrackProcessingStatus.Pending;

    /// <summary>
    /// Нормализация громкости
    /// </summary>
    public double? LoudnessLufs { get; set; }

    /// <summary>
    /// Массив peak-значений для рендеринга waveform в UI
    /// </summary>
    public List<float>? WaveformPeaks { get; set; }

    /// <summary>
    /// Chromaprint-fingerprint для дедупликации и антипиратства
    /// </summary>
    public string? AcousticFingerprint { get; set; }

    /// <summary>
    /// Состояние HLS-транскодинга (multi-bitrate AAC → .m3u8 + .ts)
    /// Ставится воркером после завершения базового анализа (ProcessingStatus = Ready)
    /// NotRequested = HLS ещё никто не запрашивал
    /// </summary>
    public TrackHlsStatus HlsStatus { get; set; } = TrackHlsStatus.NotRequested;

    public NpgsqlTsVector? SearchVector { get; set; }
}

public enum TrackDeletionReason
{
    SelfDeleted = 0,
    ModeratorRemoved = 1,
    DmcaTakedown = 2
}