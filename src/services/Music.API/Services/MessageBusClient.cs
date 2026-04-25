using Music.Shared.Contracts.Messaging;
using RabbitMQ.Client;
using RabbitMQ.Client.Exceptions;
using System.Text.Json;

namespace Music.API.Services;

public class MessageBusClient : IAsyncDisposable
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<MessageBusClient> _log;
    private readonly SemaphoreSlim _initLock = new(1, 1);
    private readonly object _channelLock = new();

    private IConnection? _connection;
    private IModel? _channel;

    public MessageBusClient(IConfiguration configuration, ILogger<MessageBusClient> log)
    {
        _configuration = configuration;
        _log = log;
    }

    private async Task EnsureConnectedAsync(CancellationToken ct = default)
    {
        if (_connection is { IsOpen: true } && _channel is { IsOpen: true })
            return;

        await _initLock.WaitAsync(ct);
        try
        {
            if (_connection is { IsOpen: true } && _channel is { IsOpen: true })
                return;

            var factory = new ConnectionFactory
            {
                HostName = _configuration["RabbitMQ:HostName"] ?? "localhost",
                Port = int.TryParse(_configuration["RabbitMQ:Port"], out var p) ? p : 5672,
                UserName = _configuration["RabbitMQ:UserName"] ?? "guest",
                Password = _configuration["RabbitMQ:Password"] ?? "guest",
                AutomaticRecoveryEnabled = true,
                NetworkRecoveryInterval = TimeSpan.FromSeconds(5)
            };

            var delay = TimeSpan.FromSeconds(2);
            for (var attempt = 1; attempt <= 5; attempt++)
            {
                try
                {
                    _connection = factory.CreateConnection("copiuma-music-api");
                    _channel = _connection.CreateModel();

                    DeclareTopology(_channel);

                    _channel.ConfirmSelect();
                    _log.LogInformation("RabbitMQ подключен (попытка {Attempt}).", attempt);
                    return;
                }
                catch (BrokerUnreachableException ex)
                {
                    _log.LogWarning(ex, "RabbitMQ недоступен, попытка {Attempt}/5.", attempt);
                    await Task.Delay(delay, ct);
                    delay = delay * 2;
                }
            }

            throw new InvalidOperationException("Не удалось подключиться к RabbitMQ за 5 попыток.");
        }
        finally
        {
            _initLock.Release();
        }
    }

    public async Task PublishAudioProcessingJobAsync(
        Guid trackId, string source = "upload", CancellationToken ct = default)
    {
        await EnsureConnectedAsync(ct);

        var job = new AudioProcessingJob(
            TrackId: trackId,
            EnqueuedAt: DateTime.UtcNow,
            Source: source);

        var body = JsonSerializer.SerializeToUtf8Bytes(job);

        lock (_channelLock)
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
                body: body);

            _channel.WaitForConfirmsOrDie(TimeSpan.FromSeconds(5));
        }

        _log.LogInformation(
            "AudioProcessingJob {TrackId} опубликован (source={Source}).", trackId, source);
    }

    private static void DeclareTopology(IModel channel)
    {
        channel.ExchangeDeclare(
            exchange: AudioJobRouting.Exchange,
            type: ExchangeType.Direct,
            durable: true,
            autoDelete: false);

        channel.ExchangeDeclare(
            exchange: AudioJobRouting.DeadLetterExchange,
            type: ExchangeType.Direct,
            durable: true,
            autoDelete: false);

        channel.QueueDeclare(
            queue: AudioJobRouting.DeadLetterQueue,
            durable: true,
            exclusive: false,
            autoDelete: false);

        channel.QueueBind(
            queue: AudioJobRouting.DeadLetterQueue,
            exchange: AudioJobRouting.DeadLetterExchange,
            routingKey: AudioJobRouting.RoutingKey);

        var args = new Dictionary<string, object>
        {
            ["x-dead-letter-exchange"] = AudioJobRouting.DeadLetterExchange,
            ["x-dead-letter-routing-key"] = AudioJobRouting.RoutingKey,
        };

        channel.QueueDeclare(
            queue: AudioJobRouting.Queue,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: args);

        channel.QueueBind(
            queue: AudioJobRouting.Queue,
            exchange: AudioJobRouting.Exchange,
            routingKey: AudioJobRouting.RoutingKey);
    }

    public ValueTask DisposeAsync()
    {
        try
        {
            _channel?.Close();
            _connection?.Close();
        }
        catch { }
        _channel?.Dispose();
        _connection?.Dispose();
        return ValueTask.CompletedTask;
    }
}