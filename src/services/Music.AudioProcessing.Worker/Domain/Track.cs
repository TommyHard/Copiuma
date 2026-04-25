using Music.Shared.Contracts.Audio;

namespace Music.AudioProcessing.Worker.Domain;

public class Track
{
    public Guid Id { get; set; }

    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;

    public TimeSpan? Duration { get; set; }
    public double? LoudnessLufs { get; set; }
    public List<float>? WaveformPeaks { get; set; }
    public string? AcousticFingerprint { get; set; }

    public TrackProcessingStatus ProcessingStatus { get; set; } = TrackProcessingStatus.Pending;
    public TrackHlsStatus HlsStatus { get; set; } = TrackHlsStatus.NotRequested;

    /// <summary>
    /// Soft-delete: если != null, воркер скипает (трек удалён, обрабатывать нечего)
    /// </summary>
    public DateTime? DeletedAt { get; set; }

    public Guid UploadedByUserId { get; set; }
}