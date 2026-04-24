namespace Music.API.Models;

public class AuditEvent
{
    public Guid Id { get; set; }

    public Guid? UserId { get; set; }

    public required string Action { get; set; }

    public required string Method { get; set; }
    public required string Path { get; set; }

    public int StatusCode { get; set; }
    public long DurationMs { get; set; }

    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? CorrelationId { get; set; }

    public string? Metadata { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}