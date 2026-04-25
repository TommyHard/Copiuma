using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Models;

namespace Music.API.Services;

/// <summary>
/// Фоновый worker. Слушает AudioProcessingQueue, скачивает трек из MinIO,
/// гонит в IAudioAnalyzer, пишет результат в Track.
///
/// После анализа запускает HLS multi-bitrate транскодинг
/// (IHlsTranscoder) и обновляет Track.HlsStatus
/// </summary>
public class AudioProcessingWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly AudioProcessingQueue _queue;
    private readonly ILogger<AudioProcessingWorker> _log;

    public AudioProcessingWorker(
        IServiceScopeFactory scopes,
        AudioProcessingQueue queue,
        ILogger<AudioProcessingWorker> log)
    {
        _scopes = scopes;
        _queue = queue;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ReEnqueuePendingAsync(stoppingToken);

        await foreach (var trackId in _queue.ReadAllAsync(stoppingToken))
        {
            try
            {
                await ProcessOneAsync(trackId, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Audio processing failed for {TrackId}", trackId);
                await MarkAnalysisFailedAsync(trackId, stoppingToken);
            }
        }
    }

    private async Task ReEnqueuePendingAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var pending = await db.Tracks
            .Where(t =>
                t.ProcessingStatus == TrackProcessingStatus.Pending
                || t.ProcessingStatus == TrackProcessingStatus.Processing
                || (t.ProcessingStatus == TrackProcessingStatus.Ready
                    && (t.HlsStatus == TrackHlsStatus.Pending
                        || t.HlsStatus == TrackHlsStatus.Processing)))
            .Select(t => t.Id)
            .ToListAsync(ct);

        foreach (var id in pending)
            await _queue.EnqueueAsync(id, ct);

        if (pending.Count > 0)
            _log.LogInformation("Re-enqueued {Count} pending tracks on startup.", pending.Count);
    }

    private async Task ProcessOneAsync(Guid trackId, CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<AppDbContext>();
        var storage = sp.GetRequiredService<FileStorageService>();
        var analyzer = sp.GetRequiredService<IAudioAnalyzer>();
        var hls = sp.GetService<IHlsTranscoder>();

        var track = await db.Tracks.FindAsync(new object?[] { trackId }, ct);
        if (track is null) return;
        if (track.DeletedAt != null) return;

        if (track.ProcessingStatus != TrackProcessingStatus.Ready)
        {
            track.ProcessingStatus = TrackProcessingStatus.Processing;
            await db.SaveChangesAsync(ct);

            await using var buffer = new MemoryStream();
            await storage.StreamToAsync(track.FileName, buffer, ct);
            buffer.Position = 0;

            var result = await analyzer.AnalyzeAsync(buffer, track.ContentType, ct);

            track.Duration = result.Duration;
            track.LoudnessLufs = result.LoudnessLufs;
            track.WaveformPeaks = result.WaveformPeaks.ToList();
            track.AcousticFingerprint = result.AcousticFingerprint;
            track.ProcessingStatus = TrackProcessingStatus.Ready;

            if (hls is not null && track.HlsStatus == TrackHlsStatus.NotRequested)
                track.HlsStatus = TrackHlsStatus.Pending;

            await db.SaveChangesAsync(ct);
            _log.LogInformation("Audio processed: {TrackId} duration={Duration}", trackId, track.Duration);
        }

        if (hls is null)
        {
            _log.LogDebug("IHlsTranscoder not registered, skipping HLS for {TrackId}", trackId);
            return;
        }

        if (track.HlsStatus is TrackHlsStatus.Ready or TrackHlsStatus.NotRequested)
            return;

        try
        {
            track.HlsStatus = TrackHlsStatus.Processing;
            await db.SaveChangesAsync(ct);

            await using var buffer = new MemoryStream();
            await storage.StreamToAsync(track.FileName, buffer, ct);
            buffer.Position = 0;

            await hls.TranscodeAndUploadAsync(trackId, buffer, track.ContentType, ct);

            track.HlsStatus = TrackHlsStatus.Ready;
            await db.SaveChangesAsync(ct);
            _log.LogInformation("HLS ready: {TrackId}", trackId);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "HLS transcode failed for {TrackId}", trackId);
            await MarkHlsFailedAsync(trackId, ct);
        }
    }

    private async Task MarkAnalysisFailedAsync(Guid trackId, CancellationToken ct)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Tracks
                .Where(t => t.Id == trackId)
                .ExecuteUpdateAsync(u => u.SetProperty(t => t.ProcessingStatus, TrackProcessingStatus.Failed), ct);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to mark track {TrackId} as Failed", trackId);
        }
    }

    private async Task MarkHlsFailedAsync(Guid trackId, CancellationToken ct)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Tracks
                .Where(t => t.Id == trackId)
                .ExecuteUpdateAsync(u => u.SetProperty(t => t.HlsStatus, TrackHlsStatus.Failed), ct);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Failed to mark HlsStatus=Failed for {TrackId}", trackId);
        }
    }
}