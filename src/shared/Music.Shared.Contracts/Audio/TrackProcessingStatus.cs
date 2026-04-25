namespace Music.Shared.Contracts.Audio;

/// <summary>
/// Состояние конвейера базовой обработки трека (loudnorm + duration/lufs/peaks/fingerprint)
/// </summary>
public enum TrackProcessingStatus
{
    Pending = 0,
    Processing = 1,
    Ready = 2,
    Failed = 3
}