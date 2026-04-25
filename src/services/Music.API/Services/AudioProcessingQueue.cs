using System.Threading.Channels;

namespace Music.API.Services;

/// <summary>
/// In-process очередь задач обработки аудио
/// Observability: Count — для метрики copiuma_audio_queue_depth
/// </summary>
public class AudioProcessingQueue
{
    private readonly Channel<Guid> _channel = Channel.CreateUnbounded<Guid>(
        new UnboundedChannelOptions
        {
            SingleReader = true, // один worker
            SingleWriter = false // TracksController пишет из любых потоков
        });

    public ValueTask EnqueueAsync(Guid trackId, CancellationToken ct = default) =>
        _channel.Writer.WriteAsync(trackId, ct);

    public IAsyncEnumerable<Guid> ReadAllAsync(CancellationToken ct) =>
        _channel.Reader.ReadAllAsync(ct);

    /// <summary>
    /// Текущее число элементов в очереди (для observability)
    /// Возвращает -1, если реализация Channel не поддерживает счётчик
    /// </summary>
    public long Count => _channel.Reader.CanCount ? _channel.Reader.Count : -1L;
}