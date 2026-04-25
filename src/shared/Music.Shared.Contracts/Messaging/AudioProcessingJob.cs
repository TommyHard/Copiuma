namespace Music.Shared.Contracts.Messaging;

/// <summary>
/// Команда "обработай этот трек"
/// <see cref="TrackId"/> — единственный идентификатор. Воркер сам читает из БД
/// актуальные FileName, ContentType, ProcessingStatus, HlsStatus
/// <see cref="EnqueuedAt"/> — момент публикации, для observability/age-метрик
/// <see cref="Source"/> — кто публиковал ("upload", "admin-rerun", "startup-recovery")
/// </summary>
public sealed record AudioProcessingJob(
    Guid TrackId,
    DateTime EnqueuedAt,
    string Source);