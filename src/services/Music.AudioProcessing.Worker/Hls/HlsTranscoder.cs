using System.Diagnostics;
using Music.AudioProcessing.Worker.Storage;

namespace Music.AudioProcessing.Worker.Hls;

public class HlsTranscoder : IHlsTranscoder
{
    private readonly AudioStorageService _storage;
    private readonly ILogger<HlsTranscoder> _log;

    private static readonly TimeSpan ProcessTimeout = TimeSpan.FromMinutes(10);
    private const int HlsSegmentSeconds = 6;

    private static readonly (string Name, int BitrateKbps)[] Variants =
    {
        ("low",  64),
        ("mid",  128),
        ("high", 256)
    };

    public HlsTranscoder(AudioStorageService storage, ILogger<HlsTranscoder> log)
    {
        _storage = storage;
        _log = log;
    }

    public async Task TranscodeAndUploadAsync(
        Guid trackId, Stream source, string contentType, CancellationToken ct = default)
    {
        var ext = GuessExtension(contentType);
        var workDir = Path.Combine(Path.GetTempPath(), $"copiuma_hls_{trackId:N}");
        var inputPath = Path.Combine(workDir, $"input{ext}");
        Directory.CreateDirectory(workDir);
        foreach (var (name, _) in Variants)
            Directory.CreateDirectory(Path.Combine(workDir, $"stream_{name}"));

        try
        {
            await using (var fs = File.Create(inputPath))
                await source.CopyToAsync(fs, ct);

            await RunFfmpegAsync(inputPath, workDir, ct);
            await UploadAllArtifactsAsync(trackId, workDir, ct);

            _log.LogInformation("HLS transcode complete for {TrackId} in {Dir}", trackId, workDir);
        }
        finally
        {
            try
            {
                if (Directory.Exists(workDir))
                    Directory.Delete(workDir, recursive: true);
            }
            catch (Exception ex)
            {
                _log.LogDebug(ex, "HLS temp cleanup failed: {Dir}", workDir);
            }
        }
    }

    private async Task RunFfmpegAsync(string inputPath, string workDir, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "ffmpeg",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            WorkingDirectory = workDir
        };

        psi.ArgumentList.Add("-nostdin");
        psi.ArgumentList.Add("-hide_banner");
        psi.ArgumentList.Add("-loglevel"); psi.ArgumentList.Add("warning");
        psi.ArgumentList.Add("-y");
        psi.ArgumentList.Add("-i"); psi.ArgumentList.Add(inputPath);

        foreach (var (_, kbps) in Variants)
        {
            psi.ArgumentList.Add("-map"); psi.ArgumentList.Add("0:a");
            psi.ArgumentList.Add("-vn");
            psi.ArgumentList.Add("-c:a"); psi.ArgumentList.Add("aac");
            psi.ArgumentList.Add("-b:a"); psi.ArgumentList.Add($"{kbps}k");
            psi.ArgumentList.Add("-ar"); psi.ArgumentList.Add("44100");
            psi.ArgumentList.Add("-ac"); psi.ArgumentList.Add("2");
        }

        psi.ArgumentList.Add("-f"); psi.ArgumentList.Add("hls");
        psi.ArgumentList.Add("-hls_time"); psi.ArgumentList.Add(HlsSegmentSeconds.ToString());
        psi.ArgumentList.Add("-hls_playlist_type"); psi.ArgumentList.Add("vod");
        psi.ArgumentList.Add("-hls_segment_type"); psi.ArgumentList.Add("mpegts");
        psi.ArgumentList.Add("-hls_segment_filename"); psi.ArgumentList.Add("stream_%v/seg_%03d.ts");
        psi.ArgumentList.Add("-master_pl_name"); psi.ArgumentList.Add("master.m3u8");

        var streamMap = string.Join(' ', Variants.Select((v, i) => $"a:{i},name:{v.Name}"));
        psi.ArgumentList.Add("-var_stream_map"); psi.ArgumentList.Add(streamMap);

        psi.ArgumentList.Add("stream_%v/index.m3u8");

        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException("Failed to start ffmpeg (HLS)");

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(ProcessTimeout);

        var stderrTask = proc.StandardError.ReadToEndAsync(cts.Token);
        var stdoutTask = proc.StandardOutput.ReadToEndAsync(cts.Token);

        try { await proc.WaitForExitAsync(cts.Token); }
        catch (OperationCanceledException)
        {
            try { proc.Kill(entireProcessTree: true); } catch { }
            throw new TimeoutException($"ffmpeg HLS exceeded {ProcessTimeout.TotalMinutes} min");
        }

        var stderr = await stderrTask;
        _ = await stdoutTask;

        if (proc.ExitCode != 0)
            throw new InvalidOperationException(
                $"ffmpeg HLS exit={proc.ExitCode}: {Tail(stderr)}");
    }

    private async Task UploadAllArtifactsAsync(Guid trackId, string workDir, CancellationToken ct)
    {
        var prefix = $"{trackId:D}";

        await UploadOneAsync(
            Path.Combine(workDir, "master.m3u8"),
            $"{prefix}/master.m3u8",
            "application/vnd.apple.mpegurl",
            ct);

        foreach (var (name, _) in Variants)
        {
            var variantDir = Path.Combine(workDir, $"stream_{name}");
            if (!Directory.Exists(variantDir))
                throw new InvalidOperationException($"ffmpeg не создал директорию варианта: {variantDir}");

            await UploadOneAsync(
                Path.Combine(variantDir, "index.m3u8"),
                $"{prefix}/stream_{name}/index.m3u8",
                "application/vnd.apple.mpegurl",
                ct);

            var segments = Directory.EnumerateFiles(variantDir, "seg_*.ts").OrderBy(f => f);
            foreach (var seg in segments)
            {
                var segName = Path.GetFileName(seg);
                await UploadOneAsync(
                    seg,
                    $"{prefix}/stream_{name}/{segName}",
                    "video/mp2t",
                    ct);
            }
        }
    }

    private async Task UploadOneAsync(string localPath, string key, string contentType, CancellationToken ct)
    {
        if (!File.Exists(localPath))
            throw new FileNotFoundException($"HLS artifact missing: {localPath}");

        await using var fs = File.OpenRead(localPath);
        await _storage.UploadHlsObjectAsync(key, fs, contentType, fs.Length, ct);
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

    private static string Tail(string s, int max = 1024)
        => string.IsNullOrEmpty(s) ? "" : (s.Length <= max ? s : s[^max..]);
}