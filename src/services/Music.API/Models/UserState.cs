namespace Music.API.Models;

/// <summary>
/// Произвольный JSON-стейт пользователя, синхронизируемый между его устройствами:
/// тема, размеры сайдбаров, последний играющий трек / позиция / громкость и т.п.
///
/// Хранится одной строкой JSON, без миграций
/// </summary>
public class UserState
{
    public Guid UserId { get; set; }
    /// <summary> 
    /// JSON-сериализованный стейт. Любая структура 
    /// </summary>
    public string StateJson { get; set; } = "{}";
    /// <summary> 
    /// Версия состояния, увеличивается на каждый PUT. Для
    /// решения конфликтов между устройствами
    /// </summary>
    public long Version { get; set; }
    public DateTime UpdatedAt { get; set; }
}