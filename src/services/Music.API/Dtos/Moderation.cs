using Music.API.Models;

namespace Music.API.Dtos;

// Reports

public record CreateReportRequest(
    ReportTargetType TargetType,
    Guid TargetId,
    string Reason,
    string? Details);

public record ReportItem(
    Guid Id,
    Guid ReporterUserId,
    ReportTargetType TargetType,
    Guid TargetId,
    string Reason,
    string? Details,
    ReportStatus Status,
    DateTime CreatedAt,
    DateTime? ResolvedAt,
    string? ResolutionNote);

public record ResolveReportRequest(
    ReportStatus NewStatus, // Actioned / Dismissed
    string? Note);

// Admin actions

public record ShadowbanRequest(
    string? Note,
    DateTime? ExpiresAt);

public record DmcaTakedownRequest(
    string? Note,
    string? ClaimantEmail,
    string? ClaimReference);

// Track flags

public record SetExplicitRequest(bool IsExplicit);