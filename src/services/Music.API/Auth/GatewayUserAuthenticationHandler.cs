using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace Music.API.Auth;

public class GatewayUserAuthenticationOptions : AuthenticationSchemeOptions { }

public class GatewayUserAuthenticationHandler : AuthenticationHandler<GatewayUserAuthenticationOptions>
{
    public const string SchemeName = "GatewayUser";

    public GatewayUserAuthenticationHandler(
        IOptionsMonitor<GatewayUserAuthenticationOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        ISystemClock clock)
        : base(options, logger, encoder, clock) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var userId = Request.Headers["X-User-Id"].FirstOrDefault();
        if (string.IsNullOrEmpty(userId) || !Guid.TryParse(userId, out _))
        {
            return Task.FromResult(AuthenticateResult.NoResult());
        }

        var userName = Request.Headers["X-User-Name"].FirstOrDefault() ?? userId;
        var email = Request.Headers["X-User-Email"].FirstOrDefault() ?? string.Empty;
        var role = Request.Headers["X-User-Role"].FirstOrDefault();
        var emailVerified = Request.Headers["X-User-Email-Verified"].FirstOrDefault();

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, userId),
            new Claim("DisplayName", userName),
            new Claim(ClaimTypes.Email, email),
            new Claim("email_verified", string.Equals(emailVerified, "true", StringComparison.OrdinalIgnoreCase)
                ? "true" : "false")
        };

        var safeRole = string.IsNullOrEmpty(role) ? "User"
            : role switch
            {
                "User" or "Artist" or "Moderator" or "Admin" => role,
                _ => "User"
            };
        claims.Add(new Claim(ClaimTypes.Role, safeRole));

        var identity = new ClaimsIdentity(claims, SchemeName, ClaimTypes.NameIdentifier, ClaimTypes.Role);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}