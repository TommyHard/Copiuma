using Microsoft.AspNetCore.SignalR;
using Music.API.Data;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Text;
using System.Text.Json;

namespace Music.API.Services;

public class TrackProcessingWorker : BackgroundService
{
    private readonly IConfiguration _configuration;
    private readonly IServiceProvider _serviceProvider;
    private IConnection? _connection;
    private IModel? _channel;

    public TrackProcessingWorker(IConfiguration configuration, IServiceProvider serviceProvider)
    {
        _configuration = configuration;
        _serviceProvider = serviceProvider;
        InitializeRabbitMqListener();
    }

    private void InitializeRabbitMqListener()
    {
        var factory = new ConnectionFactory
        {
            HostName = _configuration["RabbitMQ:HostName"],
            Port = 5672,
            DispatchConsumersAsync = true
        };

        try
        {
            _connection = factory.CreateConnection();
            _channel = _connection.CreateModel();

            _channel.QueueDeclare(queue: "track_processing_queue", durable: true, exclusive: false, autoDelete: false, arguments: null);

            _channel.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);

            Console.WriteLine("--> [WORKER] Успешно подключился к RabbitMQ и слушает очередь.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"--> [WORKER] Ошибка подключения к RabbitMQ: {ex.Message}");
        }
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (_channel == null) return Task.CompletedTask;

        var consumer = new AsyncEventingBasicConsumer(_channel);

        consumer.Received += async (ModuleHandle, ea) =>
        {
            var body = ea.Body.ToArray();
            var message = Encoding.UTF8.GetString(body);
            Console.WriteLine($"--> [WORKER] Получено сообщение: {message}");

            try
            {
                var data = JsonSerializer.Deserialize<JsonElement>(message);
                if (data.TryGetProperty("TrackId", out var trackIdElement) && trackIdElement.TryGetGuid(out var trackId))
                {
                    using var scope = _serviceProvider.CreateScope();
                    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var storageService = scope.ServiceProvider.GetRequiredService<FileStorageService>();

                    var track = await dbContext.Tracks.FindAsync(trackId);
                    if (track != null)
                    {
                        Console.WriteLine($"--> [WORKER] Начало обработки: Скачиваем файл {track.FileName} из MinIO...");

                        using var minioStream = await storageService.GetFileStreamAsync(track.FileName);

                        var tempFilePath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + ".mp3");

                        using (var fileStream = File.Create(tempFilePath))
                        {
                            await minioStream.CopyToAsync(fileStream);
                        }

                        Console.WriteLine("--> [WORKER] Файл скачан. Анализ метаданных.");

                        try
                        {
                            var tfile = TagLib.File.Create(tempFilePath);
                            track.Duration = tfile.Properties.Duration;

                            await dbContext.SaveChangesAsync();

                            Console.WriteLine($"--> [WORKER] Готово. Длительность трека '{track.Title}': {track.Duration.Value:mm\\:ss}");

                            var hubContext = scope.ServiceProvider.GetRequiredService<Microsoft.AspNetCore.SignalR.IHubContext<Music.API.Hubs.NotificationHub>>();

                            await hubContext.Clients.All.SendAsync("TrackProcessed", new
                            {
                                TrackId = track.Id,
                                Title = track.Title,
                                Duration = track.Duration.Value.ToString(@"mm\:ss")
                            });

                            Console.WriteLine("--> [WORKER] Push-уведомление отправлено клиентам");
                        }
                        finally
                        {
                            if (File.Exists(tempFilePath))
                            {
                                File.Delete(tempFilePath);
                            }
                        }
                    }
                }

                _channel.BasicAck(deliveryTag: ea.DeliveryTag, multiple: false);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"--> [WORKER] Ошибка при обработке: {ex.Message}");
                _channel.BasicNack(deliveryTag: ea.DeliveryTag, multiple: false, requeue: true);
            }
        };

        _channel.BasicConsume(queue: "track_processing_queue", autoAck: false, consumer: consumer);

        return Task.CompletedTask;
    }

    public override void Dispose()
    {
        _channel?.Close();
        _connection?.Close();
        base.Dispose();
    }
}