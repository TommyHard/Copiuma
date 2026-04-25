using Microsoft.AspNetCore.Connections;
using RabbitMQ.Client;
using RabbitMQ.Client.Exceptions;

namespace Music.AudioProcessing.Worker.Messaging;

/// <summary>
/// Один <see cref="IConnection"/> на процесс с auto-recovery; каналы (<see cref="IModel"/>)
/// создаются по требованию (publisher/consumer/topology)
/// </summary>
public class RabbitConnection : IAsyncDisposable
{
    private readonly IConfiguration _config;
    private readonly ILogger<RabbitConnection> _log;
    private readonly SemaphoreSlim _initLock = new(1, 1);

    private IConnection? _connection;

    public RabbitConnection(IConfiguration config, ILogger<RabbitConnection> log)
    {
        _config = config;
        _log = log;
    }

    public async Task<IConnection> GetOrCreateConnectionAsync(CancellationToken ct)
    {
        if (_connection is { IsOpen: true })
            return _connection;

        await _initLock.WaitAsync(ct);
        try
        {
            if (_connection is { IsOpen: true })
                return _connection;

            var factory = new ConnectionFactory
            {
                HostName = _config["RabbitMQ:HostName"] ?? "localhost",
                Port = int.TryParse(_config["RabbitMQ:Port"], out var p) ? p : 5672,
                UserName = _config["RabbitMQ:UserName"] ?? "guest",
                Password = _config["RabbitMQ:Password"] ?? "guest",
                AutomaticRecoveryEnabled = true,
                NetworkRecoveryInterval = TimeSpan.FromSeconds(5),
                DispatchConsumersAsync = true
            };

            var delay = TimeSpan.FromSeconds(2);
            for (var attempt = 1; attempt <= 10 && !ct.IsCancellationRequested; attempt++)
            {
                try
                {
                    _connection = factory.CreateConnection("copiuma-audio-worker");
                    _log.LogInformation("RabbitMQ подключен (попытка {Attempt}).", attempt);
                    return _connection;
                }
                catch (BrokerUnreachableException ex)
                {
                    _log.LogWarning(ex, "RabbitMQ недоступен, попытка {Attempt}/10.", attempt);
                    await Task.Delay(delay, ct);
                    delay = delay * 2 < TimeSpan.FromSeconds(30) ? delay * 2 : TimeSpan.FromSeconds(30);
                }
            }

            throw new InvalidOperationException("Не удалось подключиться к RabbitMQ за 10 попыток.");
        }
        finally
        {
            _initLock.Release();
        }
    }

    /// <summary>
    /// Объявляет topology воркера
    /// </summary>
    public static void DeclareTopology(IModel channel)
    {
        channel.ExchangeDeclare(
            exchange: Music.Shared.Contracts.Messaging.AudioJobRouting.Exchange,
            type: ExchangeType.Direct,
            durable: true,
            autoDelete: false);

        channel.ExchangeDeclare(
            exchange: Music.Shared.Contracts.Messaging.AudioJobRouting.DeadLetterExchange,
            type: ExchangeType.Direct,
            durable: true,
            autoDelete: false);

        channel.QueueDeclare(
            queue: Music.Shared.Contracts.Messaging.AudioJobRouting.DeadLetterQueue,
            durable: true,
            exclusive: false,
            autoDelete: false);

        channel.QueueBind(
            queue: Music.Shared.Contracts.Messaging.AudioJobRouting.DeadLetterQueue,
            exchange: Music.Shared.Contracts.Messaging.AudioJobRouting.DeadLetterExchange,
            routingKey: Music.Shared.Contracts.Messaging.AudioJobRouting.RoutingKey);

        var args = new Dictionary<string, object>
        {
            ["x-dead-letter-exchange"] = Music.Shared.Contracts.Messaging.AudioJobRouting.DeadLetterExchange,
            ["x-dead-letter-routing-key"] = Music.Shared.Contracts.Messaging.AudioJobRouting.RoutingKey,
        };

        channel.QueueDeclare(
            queue: Music.Shared.Contracts.Messaging.AudioJobRouting.Queue,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: args);

        channel.QueueBind(
            queue: Music.Shared.Contracts.Messaging.AudioJobRouting.Queue,
            exchange: Music.Shared.Contracts.Messaging.AudioJobRouting.Exchange,
            routingKey: Music.Shared.Contracts.Messaging.AudioJobRouting.RoutingKey);
    }

    public ValueTask DisposeAsync()
    {
        try { _connection?.Close(); } catch { }
        _connection?.Dispose();
        return ValueTask.CompletedTask;
    }
}