using System.Text.Json;

namespace Identity.API.Services.Email;

public class LogEmailSender : IEmailSender
{
    private readonly ILogger<LogEmailSender> _log;
    private readonly string _path;
    private static readonly SemaphoreSlim FileLock = new(1, 1);

    public LogEmailSender(IConfiguration config, ILogger<LogEmailSender> log)
    {
        _log = log;
        _path = config["Email:LogSink:FilePath"]
                ?? Path.Combine(AppContext.BaseDirectory, "tmp", "sent-emails.jsonl");
    }

    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        _log.LogInformation(
            "[DEV-EMAIL] To={To} Subject=\"{Subject}\"\n{Body}",
            message.To, message.Subject, message.Body);

        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_path)!);
            var line = JsonSerializer.Serialize(new
            {
                ts = DateTime.UtcNow,
                to = message.To,
                subject = message.Subject,
                body = message.Body
            });
            await FileLock.WaitAsync(ct);
            try
            {
                await File.AppendAllTextAsync(_path, line + Environment.NewLine, ct);
            }
            finally { FileLock.Release(); }
        }
        catch (Exception ex)
        {
            _log.LogWarning(ex, "Не удалось дописать sent-emails.jsonl: {Path}", _path);
        }
    }
}