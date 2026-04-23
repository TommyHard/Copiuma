using Microsoft.AspNetCore.SignalR;
using Music.API.Data;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using System.Diagnostics;
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

            Console.WriteLine("--> [WORKER] Успешно подключился к RabbitMQ.");
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
                        var tempOriginalPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + "_orig.tmp");
                        var tempProcessedPath = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString() + "_norm.ogg");

                        try
                        {
                            Console.WriteLine($"--> [WORKER] Скачиваем оригинал {track.FileName}...");
                            using (var minioStream = await storageService.GetFileStreamAsync(track.FileName))
                            using (var fileStream = File.Create(tempOriginalPath))
                            {
                                await minioStream.CopyToAsync(fileStream);
                            }

                            Console.WriteLine("--> [WORKER] Запуск FFmpeg: Проход 1 (Анализ громкости)...");

                            var pass1Info = new ProcessStartInfo
                            {
                                FileName = "ffmpeg",
                                Arguments = $"-i \"{tempOriginalPath}\" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null -",
                                RedirectStandardError = true,
                                UseShellExecute = false,
                                CreateNoWindow = true
                            };

                            string pass1Output = "";
                            using (var process1 = Process.Start(pass1Info))
                            {
                                pass1Output = await process1!.StandardError.ReadToEndAsync();
                                await process1.WaitForExitAsync();
                            }

                            string jsonStats = ExtractLoudnormJson(pass1Output);
                            if (string.IsNullOrEmpty(jsonStats))
                            {
                                throw new Exception("Не удалось получить статистику loudnorm от FFmpeg");
                            }

                            var stats = JsonSerializer.Deserialize<JsonElement>(jsonStats);
                            string measuredI = stats.GetProperty("input_i").GetString()!;
                            string measuredTp = stats.GetProperty("input_tp").GetString()!;
                            string measuredLra = stats.GetProperty("input_lra").GetString()!;
                            string measuredThresh = stats.GetProperty("input_thresh").GetString()!;
                            string targetOffset = stats.GetProperty("target_offset").GetString()!;

                            Console.WriteLine("--> [WORKER] Запуск FFmpeg: Проход 2 (Кодирование в Ogg Vorbis)...");

                            var pass2Filter = $"loudnorm=I=-14:TP=-1:LRA=11:measured_I={measuredI}:measured_TP={measuredTp}:measured_LRA={measuredLra}:measured_thresh={measuredThresh}:offset={targetOffset}:linear=true";

                            var pass2Info = new ProcessStartInfo
                            {
                                FileName = "ffmpeg",
                                Arguments = $"-i \"{tempOriginalPath}\" -af \"{pass2Filter}\" -c:a libvorbis -q:a 5 \"{tempProcessedPath}\" -y",
                                RedirectStandardError = true,
                                UseShellExecute = false,
                                CreateNoWindow = true
                            };

                            using (var process2 = Process.Start(pass2Info))
                            {
                                await process2!.WaitForExitAsync();
                                if (process2.ExitCode != 0)
                                {
                                    var error = await process2.StandardError.ReadToEndAsync();
                                    throw new Exception($"FFmpeg завершил с ошибкой на 2-м проходе: {error}");
                                }
                            }

                            Console.WriteLine("--> [WORKER] Анализ и загрузка в хранилище (Ogg)...");

                            var tfile = TagLib.File.Create(tempProcessedPath);
                            track.Duration = tfile.Properties.Duration;

                            using (var processedStream = File.OpenRead(tempProcessedPath))
                            {
                                var newFileName = await storageService.UploadFileAsync(processedStream, "track.ogg", "audio/ogg");

                                track.FileName = newFileName;
                                track.ContentType = "audio/ogg";
                                await dbContext.SaveChangesAsync();
                            }

                            Console.WriteLine($"--> [WORKER] Готово. Длительность: {track.Duration.Value:mm\\:ss}");

                            var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<Hubs.NotificationHub>>();
                            await hubContext.Clients.All.SendAsync("TrackProcessed", new
                            {
                                TrackId = track.Id,
                                Title = track.Title,
                                Duration = track.Duration.Value.ToString(@"mm\:ss")
                            });
                        }
                        finally
                        {
                            if (File.Exists(tempOriginalPath)) File.Delete(tempOriginalPath);
                            if (File.Exists(tempProcessedPath)) File.Delete(tempProcessedPath);
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

    private string ExtractLoudnormJson(string ffmpegOutput)
    {
        int startIndex = ffmpegOutput.LastIndexOf("{");
        int endIndex = ffmpegOutput.LastIndexOf("}");

        if (startIndex != -1 && endIndex != -1 && endIndex > startIndex)
        {
            return ffmpegOutput.Substring(startIndex, endIndex - startIndex + 1);
        }
        return string.Empty;
    }

    public override void Dispose()
    {
        _channel?.Close();
        _connection?.Close();
        base.Dispose();
    }
}