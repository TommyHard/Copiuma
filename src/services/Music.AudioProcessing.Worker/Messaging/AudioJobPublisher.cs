using System.Text;
using System.Text.Json;
using Music.Shared.Contracts.Messaging;
using RabbitMQ.Client;

namespace Music.AudioProcessing.Worker.Messaging;

/// <summary>
/// Используется только <see cref="Recovery.StuckTracksRecoveryService"/> при старте
/// Основной publisher (для нового upload) — Music.API.Services.MessageBusClient
///
/// Один <see cref="IModel"/> на жизнь сервиса; ConfirmSelect, чтобы знать, что брокер
/// принял сообщение
/// </summary>
public class AudioJobPublisher : IAsyncDisposable
{
    private readonly RabbitConnection _conn;
    private readonly ILogger<AudioJobPublisher> _log;
    private readonly SemaphoreSlim _channelLock = new(1, 1);
    private IModel? _channel;

    public AudioJobPublisher(RabbitConnection conn, ILogger<AudioJobPublisher> log)
    {
        _conn = conn;
        _log = log;
    }

    public async Task PublishAsync(AudioProcessingJob job, CancellationToken ct = default)
    {
        await EnsureChannelAsync(ct);

        var bytes = JsonSerializer.SerializeToUtf8Bytes(job);

        await _channelLock.WaitAsync(ct);
        try
        {
            var props = _channel!.CreateBasicProperties();
            props.Persistent = true;
            props.ContentType = "application/json";
            props.MessageId = Guid.NewGuid().ToString();
            props.Type = nameof(AudioProcessingJob);

            _channel.BasicPublish(
                exchange: AudioJobRouting.Exchange,
                routingKey: AudioJobRouting.RoutingKey,
                mandatory: false,
                basicProperties: props,
                body: bytes);

            _channel.WaitForConfirmsOrDie(TimeSpan.FromSeconds(5));
        }
        finally
        {
            _channelLock.Release();
        }

        _log.LogDebug("Published AudioProcessingJob {TrackId} (source={Source}).", job.TrackId, job.Source);
    }

    private async Task EnsureChannelAsync(CancellationToken ct)
    {
        if (_channel is { IsOpen: true }) return;

        await _channelLock.WaitAsync(ct);
        try
        {
            if (_channel is { IsOpen: true }) return;

            var conn = await _conn.GetOrCreateConnectionAsync(ct);
            _channel = conn.CreateModel();
            RabbitConnection.DeclareTopology(_channel);
            _channel.ConfirmSelect();
        }
        finally
        {
            _channelLock.Release();
        }
    }

    public ValueTask DisposeAsync()
    {
        try { _channel?.Close(); } catch { }
        _channel?.Dispose();
        return ValueTask.CompletedTask;
    }
}