using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Music.Shared.Contracts.Audio;

namespace Music.AudioProcessing.Worker.Audio;

public class FFMpegAudioAnalyzer : IAudioAnalyzer
{
    private readonly ILogger<FFMpegAudioAnalyzer> _log;
    private static readonly TimeSpan ProcessTimeout = TimeSpan.FromMinutes(3);
    private const int PeakCount = 500;

    private static readonly Regex IntegratedLufsRegex = new(
        @"I:\s*(-?\d+(?:\.\d+)?)\s*LUFS",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    public FFMpegAudioAnalyzer(ILogger<FFMpegAudioAnalyzer> log) => _log = log;

    public async Task<AudioAnalysisResult> AnalyzeAsync(
        Stream audioStream, string contentType, CancellationToken ct = default)
    {
        var tempPath = Path.Combine(
            Path.GetTempPath(),
            $"copiuma_{Guid.NewGuid():N}{GuessExtension(contentType)}");

        try
        {
            await using (var fs = File.Create(tempPath))
                await audioStream.CopyToAsync(fs, ct);

            var duration = await ProbeDurationAsync(tempPath, ct);

            double lufs;
            try { lufs = await MeasureLufsAsync(tempPath, ct); }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "LUFS measurement failed for {Path}, using fallback -14.0", tempPath);
                lufs = -14.0;
            }

            IReadOnlyList<float> peaks;
            try { peaks = await BuildWaveformPeaksAsync(tempPath, ct); }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Waveform generation failed for {Path}, using flat fallback", tempPath);
                peaks = Enumerable.Repeat(0f, PeakCount).ToList();
            }

            string fingerprintHash;
            try
            {
                var raw = await ComputeFingerprintAsync(tempPath, ct);
                fingerprintHash = Sha256Hex(raw);
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "Chromaprint failed for {Path}, using file-hash fallback", tempPath);
                fingerprintHash = await Sha256OfFileAsync(tempPath, ct);
            }

            return new AudioAnalysisResult(
                Duration: duration,
                LoudnessLufs: lufs,
                WaveformPeaks: peaks,
                AcousticFingerprint: fingerprintHash);
        }
        finally
        {
            try { if (File.Exists(tempPath)) File.Delete(tempPath); }
            catch (Exception ex) { _log.LogDebug(ex, "Temp cleanup failed: {Path}", tempPath); }
        }
    }

    private async Task<TimeSpan> ProbeDurationAsync(string path, CancellationToken ct)
    {
        var (stdout, stderr, exit) = await RunAsync(
            "ffprobe",
            new[]
            {
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                path
            },
            ct);

        if (exit != 0)
            throw new InvalidOperationException($"ffprobe exit={exit}: {stderr}");

        var raw = stdout.Trim();
        if (!double.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var seconds)
            || seconds <= 0 || double.IsNaN(seconds) || double.IsInfinity(seconds))
        {
            throw new InvalidOperationException($"ffprobe returned unparseable duration: '{raw}'");
        }

        return TimeSpan.FromSeconds(seconds);
    }

    private async Task<double> MeasureLufsAsync(string path, CancellationToken ct)
    {
        var (_, stderr, exit) = await RunAsync(
            "ffmpeg",
            new[]
            {
                "-nostdin", "-hide_banner",
                "-i", path,
                "-af", "ebur128",
                "-f", "null", "-"
            },
            ct);

        if (exit != 0)
            throw new InvalidOperationException($"ffmpeg/ebur128 exit={exit}: {Tail(stderr)}");

        Match? last = null;
        foreach (Match m in IntegratedLufsRegex.Matches(stderr))
            last = m;

        if (last is null)
            throw new InvalidOperationException("Could not parse Integrated LUFS from ebur128 output");

        return double.Parse(last.Groups[1].Value, CultureInfo.InvariantCulture);
    }

    private async Task<IReadOnlyList<float>> BuildWaveformPeaksAsync(string path, CancellationToken ct)
    {
        var psi = BuildProcess(
            "ffmpeg",
            new[]
            {
                "-nostdin", "-hide_banner", "-loglevel", "error",
                "-i", path,
                "-ac", "1",
                "-ar", "8000",
                "-f", "s16le",
                "-acodec", "pcm_s16le",
                "-"
            });
        psi.RedirectStandardOutput = true;
        psi.RedirectStandardError = true;

        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start ffmpeg (waveform)");

        using var ms = new MemoryStream();
        var buf = new byte[64 * 1024];
        using (var cts = CancellationTokenSource.CreateLinkedTokenSource(ct))
        {
            cts.CancelAfter(ProcessTimeout);
            int read;
            while ((read = await proc.StandardOutput.BaseStream.ReadAsync(buf.AsMemory(0, buf.Length), cts.Token)) > 0)
                ms.Write(buf, 0, read);
        }

        var stderrTask = proc.StandardError.ReadToEndAsync(ct);
        await proc.WaitForExitAsync(ct);
        var stderr = await stderrTask;

        if (proc.ExitCode != 0)
            throw new InvalidOperationException($"ffmpeg waveform exit={proc.ExitCode}: {Tail(stderr)}");

        var pcm = ms.GetBuffer();
        var sampleCount = (int)(ms.Length / 2);
        if (sampleCount <= 0)
            throw new InvalidOperationException("ffmpeg produced empty PCM stream");

        var peaks = new float[PeakCount];
        var bucketSize = (double)sampleCount / PeakCount;

        for (int b = 0; b < PeakCount; b++)
        {
            int start = (int)(b * bucketSize);
            int end = Math.Min((int)((b + 1) * bucketSize), sampleCount);
            short max = 0;
            for (int i = start; i < end; i++)
            {
                int byteIdx = i * 2;
                short s = (short)(pcm[byteIdx] | (pcm[byteIdx + 1] << 8));
                var abs = s == short.MinValue ? short.MaxValue : Math.Abs(s);
                if (abs > max) max = (short)abs;
            }
            peaks[b] = max / 32767f;
        }

        return peaks;
    }

    private async Task<string> ComputeFingerprintAsync(string path, CancellationToken ct)
    {
        var (stdout, stderr, exit) = await RunAsync(
            "fpcalc",
            new[] { "-json", path },
            ct);

        if (exit != 0)
            throw new InvalidOperationException($"fpcalc exit={exit}: {stderr}");

        using var doc = JsonDocument.Parse(stdout);
        if (!doc.RootElement.TryGetProperty("fingerprint", out var fpProp))
            throw new InvalidOperationException("fpcalc JSON missing 'fingerprint' field");

        var fp = fpProp.GetString();
        if (string.IsNullOrWhiteSpace(fp))
            throw new InvalidOperationException("fpcalc returned empty fingerprint");

        return fp;
    }

    private static ProcessStartInfo BuildProcess(string fileName, IEnumerable<string> args)
    {
        var psi = new ProcessStartInfo
        {
            FileName = fileName,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = false
        };
        foreach (var a in args) psi.ArgumentList.Add(a);
        return psi;
    }

    private async Task<(string stdout, string stderr, int exit)> RunAsync(
        string fileName, IEnumerable<string> args, CancellationToken ct)
    {
        var psi = BuildProcess(fileName, args);

        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException($"Failed to start {fileName}");

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(ProcessTimeout);

        var stdoutTask = proc.StandardOutput.ReadToEndAsync(cts.Token);
        var stderrTask = proc.StandardError.ReadToEndAsync(cts.Token);

        try { await proc.WaitForExitAsync(cts.Token); }
        catch (OperationCanceledException)
        {
            try { proc.Kill(entireProcessTree: true); } catch { }
            throw new TimeoutException($"{fileName} exceeded {ProcessTimeout.TotalSeconds}s");
        }

        var stdout = await stdoutTask;
        var stderr = await stderrTask;
        return (stdout, stderr, proc.ExitCode);
    }

    private static string Sha256Hex(string text)
    {
        var bytes = Encoding.UTF8.GetBytes(text);
        return Convert.ToHexString(SHA256.HashData(bytes));
    }

    private static async Task<string> Sha256OfFileAsync(string path, CancellationToken ct)
    {
        await using var fs = File.OpenRead(path);
        var hash = await SHA256.HashDataAsync(fs, ct);
        return Convert.ToHexString(hash);
    }

    private static string GuessExtension(string contentType) => contentType?.ToLowerInvariant() switch
    {
        "audio/mpeg" or "audio/mp3" => ".mp3",
        "audio/flac" or "audio/x-flac" => ".flac",
        "audio/wav" or "audio/x-wav" or "audio/wave" => ".wav",
        "audio/ogg" or "audio/vorbis" => ".ogg",
        "audio/aac" => ".aac",
        "audio/mp4" or "audio/m4a" or "audio/x-m4a" => ".m4a",
        "audio/opus" => ".opus",
        "audio/webm" => ".webm",
        _ => ".bin"
    };

    private static string Tail(string s, int maxChars = 1024)
        => string.IsNullOrEmpty(s) ? "" : (s.Length <= maxChars ? s : s[^maxChars..]);
}