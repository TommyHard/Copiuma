using Identity.API.Models;

namespace Identity.API.Dtos;

public record VerifyEmailRequest(string Token);
public record ResendVerificationRequest(string Email);

public record ForgotPasswordRequest(string Email);
public record ResetPasswordRequest(string Token, string NewPassword);


public record SessionResponse(
    Guid Id,
    string DeviceLabel,
    string? IpAddress,
    string? UserAgent,
    DateTime CreatedAt,
    DateTime? LastUsedAt,
    DateTime ExpiryDate,
    bool IsCurrent);

public record BecomeArtistRequest(string? StageName);

public record MeResponse(
    Guid Id,
    string Email,
    string? DisplayName,
    UserRole Role,
    bool EmailVerified,
    DateTime CreatedAt);


public record DeviceLabelHint(string? DeviceLabel);