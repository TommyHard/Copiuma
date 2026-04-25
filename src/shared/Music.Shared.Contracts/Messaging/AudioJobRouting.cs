namespace Music.Shared.Contracts.Messaging;

public static class AudioJobRouting
{
    /// <summary>
    /// Direct exchange, durable
    /// </summary>
    public const string Exchange = "copiuma.audio.processing";

    /// <summary>
    /// Routing key для основного потока команд
    /// </summary>
    public const string RoutingKey = "audio.processing.requested";

    /// <summary>
    /// Главная очередь — её слушает Music.AudioProcessing.Worker
    /// </summary>
    public const string Queue = "audio_processing_jobs";

    /// <summary>
    /// DLX, в который попадает всё, что было ошибкой
    /// </summary>
    public const string DeadLetterExchange = "copiuma.audio.processing.dlx";

    /// <summary>
    /// DLQ сообщения для ручного разбора
    /// </summary>
    public const string DeadLetterQueue = "audio_processing_jobs.dlq";
}