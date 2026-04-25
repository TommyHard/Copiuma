using Microsoft.EntityFrameworkCore;
using Music.AudioProcessing.Worker.Data;
using Music.AudioProcessing.Worker.Messaging;
using Music.Shared.Contracts.Audio;
using Music.Shared.Contracts.Messaging;

namespace Music.AudioProcessing.Worker.Recovery;

public class StuckTracksRecoveryService : IHostedService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly AudioJobPublisher _publisher;
    private readonly ILogger<StuckTracksRecoveryService> _log;

    public StuckTracksRecoveryService(
        IServiceScopeFactory scopes,
        AudioJobPublisher publisher,
        ILogger<StuckTracksRecoveryService> log)
    {
        _scopes = scopes;
        _publisher = publisher;
        _log = log;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = _scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AudioProcessingDbContext>();

            var ids = await db.Tracks
                .Where(t =>
                    t.DeletedAt == null
                    && (
                        t.ProcessingStatus == TrackProcessingStatus.Pending
                        || t.ProcessingStatus == TrackProcessingStatus.Processing
                        || (t.ProcessingStatus == TrackProcessingStatus.Ready
                            && (t.HlsStatus == TrackHlsStatus.Pending
                                || t.HlsStatus == TrackHlsStatus.Processing))
                    ))
                .Select(t => t.Id)
                .ToListAsync(cancellationToken);

            if (ids.Count == 0)
            {
                _log.LogInformation("Recovery: зависших треков нет.");
                return;
            }

            var now = DateTime.UtcNow;
            foreach (var id in ids)
            {
                await _publisher.PublishAsync(
                    new AudioProcessingJob(id, now, "startup-recovery"),
                    cancellationToken);
            }

            _log.LogInformation("Recovery: опубликовано {Count} jobs для зависших треков.", ids.Count);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Recovery упала; воркер продолжает работу без re-enqueue.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}