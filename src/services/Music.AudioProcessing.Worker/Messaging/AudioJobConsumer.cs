using System.Text;
using System.Text.Json;
using Music.AudioProcessing.Worker.Pipeline;
using Music.AudioProcessing.Worker.Telemetry;
using Music.Shared.Contracts.Messaging;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace Music.AudioProcessing.Worker.Messaging;

public class AudioJobConsumer : BackgroundService
{
    private readonly RabbitConnection _conn;
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<AudioJobConsumer> _log;

    private IModel? _channel;
    private string? _consumerTag;

    public AudioJobConsumer(
        RabbitConnection conn,
        IServiceScopeFactory scopes,
        ILogger<AudioJobConsumer> log)
    {
        _conn = conn;
        _scopes = scopes;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var connection = await _conn.GetOrCreateConnectionAsync(stoppingToken);
        _channel = connection.CreateModel();
        RabbitConnection.DeclareTopology(_channel);
        _channel.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);

        var consumer = new AsyncEventingBasicConsumer(_channel);
        consumer.Received += OnReceivedAsync;

        _consumerTag = _channel.BasicConsume(
            queue: AudioJobRouting.Queue,
            autoAck: false,
            consumer: consumer);

        _log.LogInformation(
            "AudioJobConsumer запущен (queue={Queue}, tag={Tag}).",
            AudioJobRouting.Queue, _consumerTag);

        try
        {
            await Task.Delay(Timeout.Infinite, stoppingToken);
        }
        catch (OperationCanceledException) { }
    }

    private async Task OnReceivedAsync(object _, BasicDeliverEventArgs ea)
    {
        CopiumaMetrics.JobsReceived.Add(1);
        var deliveryTag = ea.DeliveryTag;
        Guid? trackIdForLog = null;

        try
        {
            var body = ea.Body.ToArray();
            AudioProcessingJob? job;
            try
            {
                job = JsonSerializer.Deserialize<AudioProcessingJob>(body);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Невалидный AudioProcessingJob (json), отправляем в DLQ. Body={Body}",
                    Encoding.UTF8.GetString(body));
                _channel!.BasicNack(deliveryTag, multiple: false, requeue: false);
                CopiumaMetrics.JobsDeadLettered.Add(1);
                return;
            }

            if (job is null || job.TrackId == Guid.Empty)
            {
                _log.LogError("AudioProcessingJob с пустым TrackId — DLQ.");
                _channel!.BasicNack(deliveryTag, multiple: false, requeue: false);
                CopiumaMetrics.JobsDeadLettered.Add(1);
                return;
            }

            trackIdForLog = job.TrackId;

            var age = DateTime.UtcNow - job.EnqueuedAt;
            if (age > TimeSpan.Zero)
                CopiumaMetrics.JobAgeSeconds.Record(age.TotalSeconds);

            using var scope = _scopes.CreateScope();
            var pipeline = scope.ServiceProvider.GetRequiredService<AudioPipeline>();

            await pipeline.RunAsync(job.TrackId, CancellationToken.None);

            _channel!.BasicAck(deliveryTag, multiple: false);
            CopiumaMetrics.JobsAcked.Add(1);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Неожиданная ошибка вне pipeline для {TrackId}", trackIdForLog);
            try
            {
                _channel!.BasicNack(deliveryTag, multiple: false, requeue: false);
                CopiumaMetrics.JobsDeadLettered.Add(1);
            }
            catch (Exception nackEx)
            {
                _log.LogError(nackEx, "Не удалось отриц. сообщение, channel мог закрыться.");
            }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        try
        {
            if (_channel is { IsOpen: true } && !string.IsNullOrEmpty(_consumerTag))
                _channel.BasicCancel(_consumerTag);
        }
        catch (Exception ex)
        {
            _log.LogDebug(ex, "BasicCancel при остановке упал — channel мог уже закрыться.");
        }

        try { _channel?.Close(); } catch { }
        _channel?.Dispose();

        await base.StopAsync(cancellationToken);
    }
}