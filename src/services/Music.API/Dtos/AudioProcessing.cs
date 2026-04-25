using Music.Shared.Contracts.Audio;

namespace Music.API.Dtos;

/// <summary>
/// Ответ GET /tracks/{id}/waveform — массив peaks (каждый [-1 +1]) +
/// метаданные для клиента
/// </summary>
public record WaveformResponse(
    Guid TrackId,
    IReadOnlyList<float> Peaks,
    TimeSpan Duration,
    double LoudnessLufs);

/// <summary>
/// Короткий статус обработки для поллинга клиентом
/// </summary>
public record TrackProcessingStatusResponse(
    Guid TrackId,
    TrackProcessingStatus Status,
    bool HasWaveform,
    TimeSpan? Duration);