using Music.Shared.Contracts.Audio;
using System.Diagnostics;
using System.Security.Cryptography;

namespace Music.AudioProcessing.Worker.Audio;

public class StubAudioAnalyzer : IAudioAnalyzer
{
    private const int PeakCount = 500;
    private readonly ILogger<StubAudioAnalyzer>? _log;

    public StubAudioAnalyzer(ILogger<StubAudioAnalyzer>? log = null) => _log = log;

    public async Task<AudioAnalysisResult> AnalyzeAsync(
        Stream audioStream, string contentType, CancellationToken ct = default)
    {
        using var ms = new MemoryStream();
        await audioStream.CopyToAsync(ms, ct);
        var bytes = ms.ToArray();

        var fingerprint = Convert.ToHexString(SHA256.HashData(bytes));

        TimeSpan duration;
        try
        {
            ms.Position = 0;
            var ext = GuessExtensionForTagLib(contentType);
            var abstraction = new MemoryStreamFileAbstraction($"track{ext}", ms);
            using var tagFile = TagLib.File.Create(abstraction);
            duration = tagFile.Properties?.Duration ?? TimeSpan.Zero;
            if (duration <= TimeSpan.Zero)
                throw new InvalidOperationException("TagLib returned zero duration");
        }
        catch (Exception ex)
        {
            _log?.LogWarning(ex, "TagLib could not read duration for contentType={ContentType}, falling back to 3min", contentType);
            duration = TimeSpan.FromMinutes(3);
        }

        var peaks = new float[PeakCount];
        for (int i = 0; i < PeakCount; i++)
            peaks[i] = (float)(0.5 * Math.Sin(i * Math.PI * 2 / 40.0) + 0.5 * (i % 7 == 0 ? 0.4 : 0.2));

        return new AudioAnalysisResult(
            Duration: duration,
            LoudnessLufs: -14.0,
            WaveformPeaks: peaks,
            AcousticFingerprint: fingerprint);
    }

    private static string GuessExtensionForTagLib(string contentType) => contentType?.ToLowerInvariant() switch
    {
        "audio/mpeg" or "audio/mp3" => ".mp3",
        "audio/flac" or "audio/x-flac" => ".flac",
        "audio/wav" or "audio/x-wav" or "audio/wave" => ".wav",
        "audio/ogg" or "audio/vorbis" => ".ogg",
        "audio/aac" => ".aac",
        "audio/mp4" or "audio/m4a" or "audio/x-m4a" => ".m4a",
        "audio/opus" => ".opus",
        _ => ".mp3"
    };

    private sealed class MemoryStreamFileAbstraction : TagLib.File.IFileAbstraction
    {
        public MemoryStreamFileAbstraction(string name, Stream stream)
        {
            Name = name;
            ReadStream = stream;
            WriteStream = stream;
        }

        public string Name { get; }
        public Stream ReadStream { get; }
        public Stream WriteStream { get; }

        public void CloseStream(Stream stream) => stream.Position = 0;
    }
}