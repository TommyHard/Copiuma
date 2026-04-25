using System.Diagnostics.Metrics;

namespace Music.AudioProcessing.Worker.Telemetry;

public static class CopiumaMetrics
{
    public const string MeterName = "Copiuma.Music.AudioProcessing";

    public static readonly Meter Meter = new(MeterName, "1.0.0");

    // Pipeline stages

    public static readonly Histogram<double> AudioAnalysisSeconds =
        Meter.CreateHistogram<double>(
            "copiuma_audio_analysis_seconds",
            unit: "s",
            description: "End-to-end audio analysis duration per track (worker).");

    public static readonly Counter<long> AudioAnalysisFailures =
        Meter.CreateCounter<long>(
            "copiuma_audio_analysis_failures_total",
            description: "Audio analysis failures (worker).");

    public static readonly Histogram<double> HlsTranscodeSeconds =
        Meter.CreateHistogram<double>(
            "copiuma_hls_transcode_seconds",
            unit: "s",
            description: "HLS transcode + upload duration per track (worker).");

    public static readonly Counter<long> HlsTranscodeSuccess =
        Meter.CreateCounter<long>(
            "copiuma_hls_transcode_success_total",
            description: "Tracks reaching HlsStatus=Ready (worker).");

    public static readonly Counter<long> HlsTranscodeFailures =
        Meter.CreateCounter<long>(
            "copiuma_hls_transcode_failures_total",
            description: "Tracks reaching HlsStatus=Failed (worker).");

    public static readonly Histogram<double> LoudnormSeconds =
        Meter.CreateHistogram<double>(
            "copiuma_loudnorm_seconds",
            unit: "s",
            description: "Loudnorm pass1+pass2 duration per track (worker).");

    public static readonly Counter<long> LoudnormFailures =
        Meter.CreateCounter<long>(
            "copiuma_loudnorm_failures_total",
            description: "Loudnorm failures (worker).");

    // Messaging

    public static readonly Counter<long> JobsReceived =
        Meter.CreateCounter<long>(
            "copiuma_audio_jobs_received_total",
            description: "Jobs pulled off audio_processing_jobs queue.");

    public static readonly Counter<long> JobsAcked =
        Meter.CreateCounter<long>(
            "copiuma_audio_jobs_acked_total",
            description: "Jobs successfully processed (BasicAck).");

    public static readonly Counter<long> JobsDeadLettered =
        Meter.CreateCounter<long>(
            "copiuma_audio_jobs_deadlettered_total",
            description: "Jobs nack'ed without requeue (sent to DLQ).");

    public static readonly Histogram<double> JobAgeSeconds =
        Meter.CreateHistogram<double>(
            "copiuma_audio_job_age_seconds",
            unit: "s",
            description: "Time between job EnqueuedAt and the moment the consumer received it.");

    // Helper

    public static double ElapsedSeconds(System.Diagnostics.Stopwatch sw)
        => sw.Elapsed.TotalSeconds;
}