using Music.Shared.Contracts.Audio;

namespace Music.AudioProcessing.Worker.Audio;

public interface IAudioAnalyzer
{
    Task<AudioAnalysisResult> AnalyzeAsync(
        Stream audioStream,
        string contentType,
        CancellationToken ct = default);
}