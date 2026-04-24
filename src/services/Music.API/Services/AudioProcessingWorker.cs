using Microsoft.EntityFrameworkCore;
using Music.API.Data;
using Music.API.Models;

namespace Music.API.Services;

/// <summary>
/// Фоновый worker. Слушает AudioProcessingQueue, скачивает трек из MinIO,
/// гонит в IAudioAnalyzer, пишет результат в Track
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
                await MarkFailedAsync(trackId, stoppingToken);
            }
        }
    }

    private async Task ReEnqueuePendingAsync(CancellationToken ct)
    {
        using var scope = _scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var pending = await db.Tracks
            .Where(t => t.ProcessingStatus == TrackProcessingStatus.Pending
                        || t.ProcessingStatus == TrackProcessingStatus.Processing)
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

        var track = await db.Tracks.FindAsync(new object?[] { trackId }, ct);
        if (track is null) return;
        if (track.DeletedAt != null) return; // трек удалили, пока стоял в очереди
        if (track.ProcessingStatus == TrackProcessingStatus.Ready) return; // уже обработан

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

        await db.SaveChangesAsync(ct);
        _log.LogInformation("Audio processed: {TrackId} duration={Duration}", trackId, track.Duration);
    }

    private async Task MarkFailedAsync(Guid trackId, CancellationToken ct)
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
}