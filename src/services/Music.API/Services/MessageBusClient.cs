using RabbitMQ.Client;
using RabbitMQ.Client.Exceptions;
using System.Text;
using System.Text.Json;

namespace Music.API.Services;

public class MessageBusClient : IAsyncDisposable
{
    public const string MainQueue = "track_processing_queue";
    public const string DeadLetterExchange = "track_processing_dlx";
    public const string DeadLetterQueue = "track_processing_dlq";

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
                    _connection = factory.CreateConnection();
                    _channel = _connection.CreateModel();

                    _channel.ExchangeDeclare(DeadLetterExchange, ExchangeType.Direct, durable: true);
                    _channel.QueueDeclare(DeadLetterQueue, durable: true, exclusive: false, autoDelete: false);
                    _channel.QueueBind(DeadLetterQueue, DeadLetterExchange, routingKey: MainQueue);

                    var args = new Dictionary<string, object>
                    {
                        ["x-dead-letter-exchange"] = DeadLetterExchange,
                        ["x-dead-letter-routing-key"] = MainQueue
                    };
                    _channel.QueueDeclare(MainQueue, durable: true, exclusive: false, autoDelete: false, arguments: args);

                    _channel.ConfirmSelect();
                    _log.LogInformation("Подключились к RabbitMQ (попытка {Attempt}).", attempt);
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

    public async Task PublishNewTrackEventAsync(Guid trackId, CancellationToken ct = default)
    {
        await EnsureConnectedAsync(ct);

        var message = JsonSerializer.Serialize(new { TrackId = trackId, Event = "TrackUploaded" });
        var body = Encoding.UTF8.GetBytes(message);

        lock (_channelLock)
        {
            var props = _channel!.CreateBasicProperties();
            props.Persistent = true;
            props.ContentType = "application/json";
            props.MessageId = Guid.NewGuid().ToString();

            _channel.BasicPublish(
                exchange: string.Empty,
                routingKey: MainQueue,
                basicProperties: props,
                body: body);

            _channel.WaitForConfirmsOrDie(TimeSpan.FromSeconds(5));
        }

        _log.LogInformation("Событие TrackUploaded {TrackId} опубликовано.", trackId);
    }

    public ValueTask DisposeAsync()
    {
        try
        {
            _channel?.Close();
            _connection?.Close();
        }
        catch { /* ignore */ }
        _channel?.Dispose();
        _connection?.Dispose();
        return ValueTask.CompletedTask;
    }
}
