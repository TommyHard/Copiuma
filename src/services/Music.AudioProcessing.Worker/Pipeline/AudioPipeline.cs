using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Music.AudioProcessing.Worker.Audio;
using Music.AudioProcessing.Worker.Data;
using Music.AudioProcessing.Worker.Hls;
using Music.AudioProcessing.Worker.Loudnorm;
using Music.AudioProcessing.Worker.Storage;
using Music.AudioProcessing.Worker.Telemetry;
using Music.Shared.Contracts.Audio;

namespace Music.AudioProcessing.Worker.Pipeline;

public class AudioPipeline
{
    private readonly AudioProcessingDbContext _db;
    private readonly AudioStorageService _storage;
    private readonly IAudioAnalyzer _analyzer;
    private readonly IHlsTranscoder? _hls;
    private readonly ILoudnormService? _loudnorm;
    private readonly ILogger<AudioPipeline> _log;

    public AudioPipeline(
        AudioProcessingDbContext db,
        AudioStorageService storage,
        IAudioAnalyzer analyzer,
        ILogger<AudioPipeline> log,
        IServiceProvider sp)
    {
        _db = db;
        _storage = storage;
        _analyzer = analyzer;
        _log = log;
        _hls = sp.GetService<IHlsTranscoder>();
        _loudnorm = sp.GetService<ILoudnormService>();
    }

    public async Task RunAsync(Guid trackId, CancellationToken ct)
    {
        var track = await _db.Tracks.FirstOrDefaultAsync(t => t.Id == trackId, ct);
        if (track is null)
        {
            _log.LogWarning("Track {TrackId} не найден в БД, скип.", trackId);
            return;
        }

        if (track.DeletedAt is not null)
        {
            _log.LogInformation("Track {TrackId} soft-deleted, скип.", trackId);
            return;
        }

        if (_loudnorm is not null)
            await StageLoudnormAsync(track, ct);

        await StageAnalyzeAsync(track, ct);

        if (_hls is not null)
            await StageHlsAsync(track, ct);
    }

    private async Task StageLoudnormAsync(Domain.Track track, CancellationToken ct)
    {
        if (string.Equals(track.ContentType, "audio/ogg", StringComparison.OrdinalIgnoreCase))
        {
            _log.LogDebug("Loudnorm skip for {TrackId}: уже audio/ogg.", track.Id);
            return;
        }

        var sw = Stopwatch.StartNew();
        string? srcTmp = null;
        string? outTmp = null;

        try
        {
            srcTmp = Path.Combine(Path.GetTempPath(), $"copiuma_src_{track.Id:N}");
            await using (var fs = File.Create(srcTmp))
                await _storage.StreamToAsync(track.FileName, fs, ct);

            var result = await _loudnorm!.NormalizeAsync(srcTmp, ct);
            outTmp = result.OutputPath;

            // upload normalized -> tracks bucket
            await using (var outFs = File.OpenRead(outTmp))
            {
                var newName = await _storage.UploadTrackObjectAsync(
                    outFs, "track.ogg", "audio/ogg", outFs.Length, ct);

                var oldName = track.FileName;
                track.FileName = newName;
                track.ContentType = "audio/ogg";
                await _db.SaveChangesAsync(ct);

                await _storage.DeleteTrackObjectAsync(oldName, ct);
            }

            sw.Stop();
            CopiumaMetrics.LoudnormSeconds.Record(CopiumaMetrics.ElapsedSeconds(sw));
            _log.LogInformation(
                "Loudnorm OK {TrackId} measuredI={I:0.00} elapsed={Elapsed:0.000}s",
                track.Id, result.MeasuredI, sw.Elapsed.TotalSeconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            CopiumaMetrics.LoudnormSeconds.Record(CopiumaMetrics.ElapsedSeconds(sw));
            CopiumaMetrics.LoudnormFailures.Add(1);
            _log.LogWarning(ex, "Loudnorm failed for {TrackId}, продолжаем без нормализации.", track.Id);
        }
        finally
        {
            TryDelete(srcTmp);
            TryDelete(outTmp);
        }
    }

    private async Task StageAnalyzeAsync(Domain.Track track, CancellationToken ct)
    {
        if (track.ProcessingStatus == TrackProcessingStatus.Ready)
            return;

        var sw = Stopwatch.StartNew();
        try
        {
            track.ProcessingStatus = TrackProcessingStatus.Processing;
            await _db.SaveChangesAsync(ct);

            await using var buffer = new MemoryStream();
            await _storage.StreamToAsync(track.FileName, buffer, ct);
            buffer.Position = 0;

            var result = await _analyzer.AnalyzeAsync(buffer, track.ContentType, ct);

            track.Duration = result.Duration;
            track.LoudnessLufs = result.LoudnessLufs;
            track.WaveformPeaks = result.WaveformPeaks.ToList();
            track.AcousticFingerprint = result.AcousticFingerprint;
            track.ProcessingStatus = TrackProcessingStatus.Ready;

            if (_hls is not null && track.HlsStatus == TrackHlsStatus.NotRequested)
                track.HlsStatus = TrackHlsStatus.Pending;

            await _db.SaveChangesAsync(ct);

            sw.Stop();
            CopiumaMetrics.AudioAnalysisSeconds.Record(CopiumaMetrics.ElapsedSeconds(sw));
            _log.LogInformation(
                "Analyze OK {TrackId} duration={Duration} elapsed={Elapsed:0.000}s",
                track.Id, track.Duration, sw.Elapsed.TotalSeconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            CopiumaMetrics.AudioAnalysisSeconds.Record(CopiumaMetrics.ElapsedSeconds(sw));
            CopiumaMetrics.AudioAnalysisFailures.Add(1);

            try
            {
                await _db.Tracks
                    .Where(t => t.Id == track.Id)
                    .ExecuteUpdateAsync(
                        u => u.SetProperty(t => t.ProcessingStatus, TrackProcessingStatus.Failed),
                        ct);
            }
            catch (Exception ex2)
            {
                _log.LogError(ex2, "Не удалось пометить ProcessingStatus=Failed для {TrackId}", track.Id);
            }

            _log.LogError(ex, "Analyze failed for {TrackId}", track.Id);
        }
    }

    private async Task StageHlsAsync(Domain.Track track, CancellationToken ct)
    {
        var fresh = await _db.Tracks.FirstOrDefaultAsync(t => t.Id == track.Id, ct);
        if (fresh is null) return;

        if (fresh.ProcessingStatus != TrackProcessingStatus.Ready)
        {
            _log.LogDebug("HLS skip for {TrackId}: ProcessingStatus={Status}", track.Id, fresh.ProcessingStatus);
            return;
        }

        if (fresh.HlsStatus is TrackHlsStatus.Ready or TrackHlsStatus.NotRequested)
            return;

        var sw = Stopwatch.StartNew();
        try
        {
            fresh.HlsStatus = TrackHlsStatus.Processing;
            await _db.SaveChangesAsync(ct);

            await using var buffer = new MemoryStream();
            await _storage.StreamToAsync(fresh.FileName, buffer, ct);
            buffer.Position = 0;

            await _hls!.TranscodeAndUploadAsync(fresh.Id, buffer, fresh.ContentType, ct);

            fresh.HlsStatus = TrackHlsStatus.Ready;
            await _db.SaveChangesAsync(ct);

            sw.Stop();
            CopiumaMetrics.HlsTranscodeSeconds.Record(CopiumaMetrics.ElapsedSeconds(sw));
            CopiumaMetrics.HlsTranscodeSuccess.Add(1);

            _log.LogInformation(
                "HLS OK {TrackId} elapsed={Elapsed:0.000}s",
                fresh.Id, sw.Elapsed.TotalSeconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            CopiumaMetrics.HlsTranscodeSeconds.Record(CopiumaMetrics.ElapsedSeconds(sw));
            CopiumaMetrics.HlsTranscodeFailures.Add(1);

            try
            {
                await _db.Tracks
                    .Where(t => t.Id == fresh.Id)
                    .ExecuteUpdateAsync(
                        u => u.SetProperty(t => t.HlsStatus, TrackHlsStatus.Failed),
                        ct);
            }
            catch (Exception ex2)
            {
                _log.LogError(ex2, "Не удалось пометить HlsStatus=Failed для {TrackId}", fresh.Id);
            }

            _log.LogError(ex, "HLS failed for {TrackId}", fresh.Id);
        }
    }

    private static void TryDelete(string? path)
    {
        if (string.IsNullOrEmpty(path)) return;
        try { if (File.Exists(path)) File.Delete(path); }
        catch { }
    }
}