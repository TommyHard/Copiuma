using Microsoft.AspNetCore.SignalR;
using Music.API.Data;
using Music.API.Hubs;
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
    private readonly ILogger<TrackProcessingWorker> _log;

    private IConnection? _connection;
    private IModel? _channel;

    private static readonly TimeSpan FfmpegTimeout = TimeSpan.FromMinutes(5);

    public TrackProcessingWorker(
        IConfiguration configuration,
        IServiceProvider serviceProvider,
        ILogger<TrackProcessingWorker> log)
    {
        _configuration = configuration;
        _serviceProvider = serviceProvider;
        _log = log;
    }

    private async Task ConnectWithRetryAsync(CancellationToken ct)
    {
        var factory = new ConnectionFactory
        {
            HostName = _configuration["RabbitMQ:HostName"] ?? "localhost",
            Port = int.TryParse(_configuration["RabbitMQ:Port"], out var p) ? p : 5672,
            UserName = _configuration["RabbitMQ:UserName"] ?? "guest",
            Password = _configuration["RabbitMQ:Password"] ?? "guest",
            DispatchConsumersAsync = true,
            AutomaticRecoveryEnabled = true
        };

        var delay = TimeSpan.FromSeconds(2);
        for (var attempt = 1; attempt <= 10 && !ct.IsCancellationRequested; attempt++)
        {
            try
            {
                _connection = factory.CreateConnection();
                _channel = _connection.CreateModel();

                _channel.ExchangeDeclare(MessageBusClient.DeadLetterExchange, ExchangeType.Direct, durable: true);
                _channel.QueueDeclare(MessageBusClient.DeadLetterQueue, durable: true, exclusive: false, autoDelete: false);
                _channel.QueueBind(MessageBusClient.DeadLetterQueue, MessageBusClient.DeadLetterExchange, routingKey: MessageBusClient.MainQueue);

                var args = new Dictionary<string, object>
                {
                    ["x-dead-letter-exchange"] = MessageBusClient.DeadLetterExchange,
                    ["x-dead-letter-routing-key"] = MessageBusClient.MainQueue
                };
                _channel.QueueDeclare(MessageBusClient.MainQueue, durable: true, exclusive: false, autoDelete: false, arguments: args);
                _channel.BasicQos(prefetchSize: 0, prefetchCount: 1, global: false);

                _log.LogInformation("Worker подключился к RabbitMQ (попытка {Attempt}).", attempt);
                return;
            }
            catch (Exception ex)
            {
                _log.LogWarning(ex, "RabbitMQ недоступен для worker'а, попытка {Attempt}/10.", attempt);
                await Task.Delay(delay, ct);
                delay = delay * 2;
            }
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await ConnectWithRetryAsync(stoppingToken);
        if (_channel is null) return;

        var consumer = new AsyncEventingBasicConsumer(_channel);

        consumer.Received += async (_, ea) =>
        {
            var body = Encoding.UTF8.GetString(ea.Body.ToArray());

            try
            {
                var data = JsonSerializer.Deserialize<JsonElement>(body);
                if (!data.TryGetProperty("TrackId", out var idElement) || !idElement.TryGetGuid(out var trackId))
                {
                    _log.LogWarning("Сообщение без TrackId отправлено в DLQ: {Body}", body);
                    _channel.BasicNack(ea.DeliveryTag, multiple: false, requeue: false);
                    return;
                }

                await ProcessTrackAsync(trackId, stoppingToken);
                _channel.BasicAck(ea.DeliveryTag, multiple: false);
            }
            catch (Exception ex)
            {
                _log.LogError(ex, "Ошибка обработки трека. Уходим в DLQ.");
                _channel.BasicNack(ea.DeliveryTag, multiple: false, requeue: false);
            }
        };

        _channel.BasicConsume(queue: MessageBusClient.MainQueue, autoAck: false, consumer: consumer);

        await Task.Delay(Timeout.Infinite, stoppingToken).ContinueWith(_ => { });
    }

    private async Task ProcessTrackAsync(Guid trackId, CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var storage = scope.ServiceProvider.GetRequiredService<FileStorageService>();
        var hub = scope.ServiceProvider.GetRequiredService<IHubContext<NotificationHub>>();

        var track = await db.Tracks.FindAsync(new object[] { trackId }, ct);
        if (track is null)
        {
            _log.LogWarning("Трек {TrackId} не найден в БД — пропускаем.", trackId);
            return;
        }

        var tempOrig = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}_orig.tmp");
        var tempOut = Path.Combine(Path.GetTempPath(), $"{Guid.NewGuid()}_norm.ogg");

        try
        {
            await using (var minio = File.Create(tempOrig))
            {
                await storage.StreamToAsync(track.FileName, minio, ct);
            }

            var stats = await RunFfmpegLoudnormPass1Async(tempOrig, ct);
            await RunFfmpegLoudnormPass2Async(tempOrig, tempOut, stats, ct);

            var tfile = TagLib.File.Create(tempOut);
            track.Duration = tfile.Properties.Duration;

            var size = new FileInfo(tempOut).Length;
            await using (var outStream = File.OpenRead(tempOut))
            {
                var newName = await storage.UploadFileAsync(outStream, "track.ogg", "audio/ogg", size, ct);
                var oldName = track.FileName;
                track.FileName = newName;
                track.ContentType = "audio/ogg";
                await db.SaveChangesAsync(ct);

                try { await storage.DeleteFileAsync(oldName, ct); }
                catch (Exception ex) { _log.LogWarning(ex, "Не удалось удалить оригинал {File}", oldName); }
            }

            if (track.UploadedByUserId != Guid.Empty)
            {
                await hub.Clients.Group($"user-{track.UploadedByUserId}")
                    .SendAsync("TrackProcessed", new
                    {
                        TrackId = track.Id,
                        Title = track.Title,
                        Duration = track.Duration!.Value.ToString(@"mm\:ss")
                    }, ct);
            }
        }
        finally
        {
            if (File.Exists(tempOrig)) File.Delete(tempOrig);
            if (File.Exists(tempOut)) File.Delete(tempOut);
        }
    }

    private async Task<LoudnormStats> RunFfmpegLoudnormPass1Async(string input, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "ffmpeg",
            Arguments = $"-i \"{input}\" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null -",
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var proc = Process.Start(psi) ?? throw new InvalidOperationException("ffmpeg не запустился.");

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(FfmpegTimeout);

        var stderr = await proc.StandardError.ReadToEndAsync();
        try { await proc.WaitForExitAsync(cts.Token); }
        catch (OperationCanceledException) { TryKill(proc); throw new TimeoutException("ffmpeg pass1 timeout."); }

        var json = ExtractLastJsonBlock(stderr) ?? throw new InvalidOperationException("Не получили loudnorm stats.");
        var el = JsonSerializer.Deserialize<JsonElement>(json);

        return new LoudnormStats(
            el.GetProperty("input_i").GetString()!,
            el.GetProperty("input_tp").GetString()!,
            el.GetProperty("input_lra").GetString()!,
            el.GetProperty("input_thresh").GetString()!,
            el.GetProperty("target_offset").GetString()!);
    }

    private async Task RunFfmpegLoudnormPass2Async(string input, string output, LoudnormStats s, CancellationToken ct)
    {
        var filter = $"loudnorm=I=-14:TP=-1:LRA=11:measured_I={s.I}:measured_TP={s.Tp}:measured_LRA={s.Lra}:measured_thresh={s.Thresh}:offset={s.Offset}:linear=true";

        var psi = new ProcessStartInfo
        {
            FileName = "ffmpeg",
            Arguments = $"-i \"{input}\" -af \"{filter}\" -c:a libvorbis -q:a 5 \"{output}\" -y",
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var proc = Process.Start(psi) ?? throw new InvalidOperationException("ffmpeg не запустился.");

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(FfmpegTimeout);

        try { await proc.WaitForExitAsync(cts.Token); }
        catch (OperationCanceledException) { TryKill(proc); throw new TimeoutException("ffmpeg pass2 timeout."); }

        if (proc.ExitCode != 0)
        {
            var err = await proc.StandardError.ReadToEndAsync();
            throw new InvalidOperationException($"ffmpeg pass2 exit={proc.ExitCode}: {err}");
        }
    }

    private static void TryKill(Process p) { try { if (!p.HasExited) p.Kill(true); } catch { } }

    private static string? ExtractLastJsonBlock(string text)
    {
        var start = text.LastIndexOf('{');
        var end = text.LastIndexOf('}');
        if (start < 0 || end <= start) return null;
        return text[start..(end + 1)];
    }

    private record LoudnormStats(string I, string Tp, string Lra, string Thresh, string Offset);

    public override void Dispose()
    {
        _channel?.Close();
        _connection?.Close();
        _channel?.Dispose();
        _connection?.Dispose();
        base.Dispose();
    }
}
