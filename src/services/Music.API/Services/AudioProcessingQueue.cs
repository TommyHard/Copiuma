using System.Threading.Channels;

namespace Music.API.Services;

/// <summary>
/// In-process очередь задач обработки аудио
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
}