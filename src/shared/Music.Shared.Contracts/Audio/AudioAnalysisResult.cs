namespace Music.Shared.Contracts.Audio;

public record AudioAnalysisResult(
    TimeSpan Duration,
    double LoudnessLufs,
    IReadOnlyList<float> WaveformPeaks,
    string AcousticFingerprint);