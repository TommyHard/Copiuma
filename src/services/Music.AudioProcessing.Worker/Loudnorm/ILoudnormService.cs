namespace Music.AudioProcessing.Worker.Loudnorm;

/// <summary>
/// Двупроходный алгоритм ffmpeg loudnorm: pass1 измеряет статистику, pass2 применяет
/// нормализацию с известными значениями
///
/// Выходной формат — Ogg Vorbis q5 (~160 kbps VBR)
/// </summary>
public interface ILoudnormService
{
    /// <summary>
    /// Отправляет файл по pipeline loudnorm и возвращает путь к нормализованному ВРЕМЕННОМУ
    /// файлу. Caller отвечает за загрузку в MinIO и удаление tmp
    /// </summary>
    /// <param name="sourcePath">Путь к локальному файлу-оригиналу</param>
    Task<LoudnormResult> NormalizeAsync(string sourcePath, CancellationToken ct = default);
}

/// <summary>
/// Результат нормализации.
/// OutputPath — путь к нормализованному временному файлу (.ogg)
/// MeasuredI — интегрированный LUFS оригинала (для логирования/метрик)
/// </summary>
public sealed record LoudnormResult(string OutputPath, double MeasuredI);