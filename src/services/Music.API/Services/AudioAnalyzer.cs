using Music.API.Dtos;

namespace Music.API.Services;

/// <summary>
/// Псевдо анализатор аудио (ffmpeg / TagLib / Chromaprint)
/// Вызов ffprobe + ebur128 + chromaprint через process
/// </summary>
public interface IAudioAnalyzer
{
    Task<AudioAnalysisResult> AnalyzeAsync(
        Stream audioStream,
        string contentType,
        CancellationToken ct = default);
}

public class StubAudioAnalyzer : IAudioAnalyzer
{
    public async Task<AudioAnalysisResult> AnalyzeAsync(
        Stream audioStream, string contentType, CancellationToken ct = default)
    {
        // Читаем до 256KB, чтобы построить детерминированный fingerprint + peaks
        const int sampleSize = 256 * 1024;
        using var ms = new MemoryStream();
        var buffer = new byte[8192];
        int totalRead = 0;
        int read;
        while (totalRead < sampleSize
               && (read = await audioStream.ReadAsync(buffer.AsMemory(0, buffer.Length), ct)) > 0)
        {
            ms.Write(buffer, 0, read);
            totalRead += read;
        }
        var sample = ms.ToArray();

        var fingerprint = Convert.ToHexString(
            System.Security.Cryptography.SHA256.HashData(sample));

        const int peakCount = 500;
        var peaks = new List<float>(peakCount);
        var step = Math.Max(1, sample.Length / peakCount);
        for (int i = 0; i < peakCount; i++)
        {
            var idx = Math.Min(i * step, sample.Length - 1);
            var b = sample.Length > 0 ? sample[idx] : (byte)0;
            peaks.Add((b - 128f) / 128f); // -1 +1
        }

        return new AudioAnalysisResult(
            Duration: TimeSpan.FromMinutes(3),
            LoudnessLufs: -14.0,
            WaveformPeaks: peaks,
            AcousticFingerprint: fingerprint);
    }
}