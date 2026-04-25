using System.Diagnostics;
using System.Globalization;
using System.Text.Json;

namespace Music.AudioProcessing.Worker.Loudnorm;

public class FFMpegLoudnormService : ILoudnormService
{
    private static readonly TimeSpan ProcessTimeout = TimeSpan.FromMinutes(5);

    private readonly ILogger<FFMpegLoudnormService> _log;

    public FFMpegLoudnormService(ILogger<FFMpegLoudnormService> log) => _log = log;

    public async Task<LoudnormResult> NormalizeAsync(string sourcePath, CancellationToken ct = default)
    {
        if (!File.Exists(sourcePath))
            throw new FileNotFoundException("Loudnorm source file missing", sourcePath);

        var outputPath = Path.Combine(
            Path.GetTempPath(),
            $"copiuma_loudnorm_{Guid.NewGuid():N}.ogg");

        var stats = await Pass1Async(sourcePath, ct);
        await Pass2Async(sourcePath, outputPath, stats, ct);

        if (!File.Exists(outputPath) || new FileInfo(outputPath).Length == 0)
            throw new InvalidOperationException("Loudnorm pass2 did not produce output");

        return new LoudnormResult(
            OutputPath: outputPath,
            MeasuredI: double.Parse(stats.I, CultureInfo.InvariantCulture));
    }

    private async Task<LoudnormStats> Pass1Async(string input, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "ffmpeg",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true,
            RedirectStandardOutput = true
        };
        psi.ArgumentList.Add("-nostdin");
        psi.ArgumentList.Add("-hide_banner");
        psi.ArgumentList.Add("-i"); psi.ArgumentList.Add(input);
        psi.ArgumentList.Add("-af"); psi.ArgumentList.Add("loudnorm=I=-14:TP=-1:LRA=11:print_format=json");
        psi.ArgumentList.Add("-f"); psi.ArgumentList.Add("null");
        psi.ArgumentList.Add("-");

        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException("ffmpeg pass1 не запустился.");

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(ProcessTimeout);

        var stderrTask = proc.StandardError.ReadToEndAsync(cts.Token);

        try { await proc.WaitForExitAsync(cts.Token); }
        catch (OperationCanceledException)
        {
            try { proc.Kill(entireProcessTree: true); } catch { }
            throw new TimeoutException("ffmpeg pass1 timeout.");
        }

        var stderr = await stderrTask;

        if (proc.ExitCode != 0)
            throw new InvalidOperationException($"ffmpeg pass1 exit={proc.ExitCode}: {Tail(stderr)}");

        var json = ExtractLastJsonBlock(stderr)
            ?? throw new InvalidOperationException("ffmpeg pass1: не нашли JSON loudnorm в stderr");

        var el = JsonSerializer.Deserialize<JsonElement>(json);
        return new LoudnormStats(
            el.GetProperty("input_i").GetString()!,
            el.GetProperty("input_tp").GetString()!,
            el.GetProperty("input_lra").GetString()!,
            el.GetProperty("input_thresh").GetString()!,
            el.GetProperty("target_offset").GetString()!);
    }

    private async Task Pass2Async(string input, string output, LoudnormStats s, CancellationToken ct)
    {
        var filter =
            $"loudnorm=I=-14:TP=-1:LRA=11:" +
            $"measured_I={s.I}:measured_TP={s.Tp}:measured_LRA={s.Lra}:" +
            $"measured_thresh={s.Thresh}:offset={s.Offset}:linear=true";

        var psi = new ProcessStartInfo
        {
            FileName = "ffmpeg",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true,
            RedirectStandardOutput = true
        };
        psi.ArgumentList.Add("-nostdin");
        psi.ArgumentList.Add("-hide_banner");
        psi.ArgumentList.Add("-y");
        psi.ArgumentList.Add("-i"); psi.ArgumentList.Add(input);
        psi.ArgumentList.Add("-af"); psi.ArgumentList.Add(filter);
        psi.ArgumentList.Add("-c:a"); psi.ArgumentList.Add("libvorbis");
        psi.ArgumentList.Add("-q:a"); psi.ArgumentList.Add("5");
        psi.ArgumentList.Add(output);

        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException("ffmpeg pass2 не запустился.");

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(ProcessTimeout);

        var stderrTask = proc.StandardError.ReadToEndAsync(cts.Token);

        try { await proc.WaitForExitAsync(cts.Token); }
        catch (OperationCanceledException)
        {
            try { proc.Kill(entireProcessTree: true); } catch { }
            throw new TimeoutException("ffmpeg pass2 timeout.");
        }

        var stderr = await stderrTask;

        if (proc.ExitCode != 0)
            throw new InvalidOperationException($"ffmpeg pass2 exit={proc.ExitCode}: {Tail(stderr)}");
    }

    private static string? ExtractLastJsonBlock(string text)
    {
        var start = text.LastIndexOf('{');
        var end = text.LastIndexOf('}');
        if (start < 0 || end <= start) return null;
        return text[start..(end + 1)];
    }

    private static string Tail(string s, int max = 1024)
        => string.IsNullOrEmpty(s) ? "" : (s.Length <= max ? s : s[^max..]);

    private sealed record LoudnormStats(string I, string Tp, string Lra, string Thresh, string Offset);
}