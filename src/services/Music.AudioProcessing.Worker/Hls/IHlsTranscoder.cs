namespace Music.AudioProcessing.Worker.Hls;

public interface IHlsTranscoder
{
    Task TranscodeAndUploadAsync(
        Guid trackId,
        Stream source,
        string contentType,
        CancellationToken ct = default);
}