using System.Diagnostics.Metrics;

namespace Music.API.Telemetry;

public static class CopiumaMetrics
{
    public const string MeterName = "Copiuma.Music.API";

    public static readonly Meter Meter = new(MeterName, "1.0.0");

    /// <summary>
    /// Сколько треков успешно загружено (после валидации, до фоновой обработки)
    /// </summary>
    public static readonly Counter<long> TracksUploaded =
        Meter.CreateCounter<long>("copiuma_tracks_uploaded_total", description: "Tracks accepted for upload.");

    /// <summary>
    /// Сколько раз клиент запросил воспроизведение трека
    /// </summary>
    public static readonly Counter<long> PlaybackRequests =
        Meter.CreateCounter<long>("copiuma_playback_requests_total", description: "Track playback requests.");

    /// <summary>
    /// Длительность одного цикла анализа (ffmpeg + tag-чтение + fingerprint)
    /// </summary>
    public static readonly Histogram<double> AudioAnalysisSeconds =
        Meter.CreateHistogram<double>(
            "copiuma_audio_analysis_seconds",
            unit: "s",
            description: "End-to-end audio analysis duration per track.");

    /// <summary>
    /// Сколько анализов завершилось ошибкой (Track.ProcessingStatus = Failed)
    /// </summary>
    public static readonly Counter<long> AudioAnalysisFailures =
        Meter.CreateCounter<long>("copiuma_audio_analysis_failures_total", description: "Audio analysis failures.");

    /// <summary>
    /// Длительность HLS-транскодинга (один проход ffmpeg + аплоад в MinIO)
    /// </summary>
    public static readonly Histogram<double> HlsTranscodeSeconds =
        Meter.CreateHistogram<double>(
            "copiuma_hls_transcode_seconds",
            unit: "s",
            description: "HLS multi-bitrate transcode + upload duration per track.");

    /// <summary>
    /// Готовых HLS-трансформаций (Ready)
    /// </summary>
    public static readonly Counter<long> HlsTranscodeSuccess =
        Meter.CreateCounter<long>("copiuma_hls_transcode_success_total", description: "Tracks reaching HlsStatus=Ready.");

    /// <summary>
    /// Упавших HLS-трансформаций (Failed)
    /// </summary>
    public static readonly Counter<long> HlsTranscodeFailures =
        Meter.CreateCounter<long>("copiuma_hls_transcode_failures_total", description: "Tracks reaching HlsStatus=Failed.");

    /// <summary>
    /// Регистрация observable-инструмента для глубины очереди
    /// Вызывается из Program.cs с Func, который читает реальное значение из AudioProcessingQueue
    /// </summary>
    public static void RegisterAudioQueueDepth(Func<long> readDepth)
    {
        Meter.CreateObservableGauge(
            "copiuma_audio_queue_depth",
            readDepth,
            description: "Current depth of in-process audio processing queue.");
    }

    public static double ElapsedSeconds(System.Diagnostics.Stopwatch sw)
        => sw.Elapsed.TotalSeconds;
}