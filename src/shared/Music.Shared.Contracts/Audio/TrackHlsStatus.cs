namespace Music.Shared.Contracts.Audio;

/// <summary>
/// Состояние HLS-транскодинга трека (multi-bitrate AAC → master.m3u8 + .ts segments)
/// </summary>
public enum TrackHlsStatus
{
    /// <summary>
    /// HLS ещё не запрашивался
    /// </summary>
    NotRequested = 0,

    /// <summary>
    /// Помечен к обработке - лежит в очереди или будет подхвачен воркером
    /// </summary>
    Pending = 1,

    /// <summary>
    /// Воркер в процессе ffmpeg-транскодинга / заливки в MinIO
    /// </summary>
    Processing = 2,

    /// <summary>
    /// master.m3u8 + варианты в bucket, можно стримить через HlsController
    /// </summary>
    Ready = 3,

    /// <summary>
    /// Транскодинг не удался. Лечится повторной публикацией job
    /// </summary>
    Failed = 4
}