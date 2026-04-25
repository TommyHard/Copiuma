using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace Identity.API.Services.Email;

/// <summary>
/// Auth-hardening: sender через MailKit. Конфигурация:
///   Email:Smtp:Host
///   Email:Smtp:Port            (default 587)
///   Email:Smtp:UserName
///   Email:Smtp:Password
///   Email:Smtp:UseStartTls
///   Email:From:Address         (обязательно)
///   Email:From:DisplayName     (default "Copiuma")
/// </summary>
public class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailSender> _log;

    public SmtpEmailSender(IConfiguration config, ILogger<SmtpEmailSender> log)
    {
        _config = config;
        _log = log;
    }

    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        var fromAddr = _config["Email:From:Address"]
            ?? throw new InvalidOperationException("Email:From:Address не настроен.");
        var fromName = _config["Email:From:DisplayName"] ?? "Copiuma";

        var mime = new MimeMessage();
        mime.From.Add(new MailboxAddress(fromName, fromAddr));
        mime.To.Add(MailboxAddress.Parse(message.To));
        mime.Subject = message.Subject;

        var builder = new BodyBuilder { TextBody = message.Body };
        if (!string.IsNullOrWhiteSpace(message.HtmlBody))
            builder.HtmlBody = message.HtmlBody;
        mime.Body = builder.ToMessageBody();

        var host = _config["Email:Smtp:Host"]
            ?? throw new InvalidOperationException("Email:Smtp:Host не настроен.");
        var port = int.TryParse(_config["Email:Smtp:Port"], out var p) ? p : 587;
        var user = _config["Email:Smtp:UserName"];
        var pass = _config["Email:Smtp:Password"];
        var useStartTls = !bool.TryParse(_config["Email:Smtp:UseStartTls"], out var s) || s;

        using var client = new SmtpClient();
        try
        {
            await client.ConnectAsync(
                host, port,
                useStartTls ? SecureSocketOptions.StartTls : SecureSocketOptions.SslOnConnect,
                ct);

            if (!string.IsNullOrEmpty(user))
                await client.AuthenticateAsync(user, pass, ct);

            await client.SendAsync(mime, ct);
            await client.DisconnectAsync(true, ct);

            _log.LogInformation("Письмо отправлено: To={To} Subject=\"{Subject}\"", message.To, message.Subject);
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "SMTP send failed: To={To}", message.To);
            throw;
        }
    }
}