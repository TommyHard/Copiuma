using System.Diagnostics.Metrics;

namespace Music.API.Telemetry;

public static class CopiumaMetrics
{
    public const string MeterName = "Copiuma.Music.API";

    public static readonly Meter Meter = new(MeterName, "1.0.0");

    /// <summary>
    /// Сколько треков успешно загружено (после валидации, до публикации в очередь)
    /// </summary>
    public static readonly Counter<long> TracksUploaded =
        Meter.CreateCounter<long>("copiuma_tracks_uploaded_total", description: "Tracks accepted for upload.");

    /// <summary>
    /// Сколько раз клиент запросил воспроизведение трека
    /// </summary>
    public static readonly Counter<long> PlaybackRequests =
        Meter.CreateCounter<long>("copiuma_playback_requests_total", description: "Track playback requests.");
}