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

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId),
            new Claim("DisplayName", userName),
            new Claim(ClaimTypes.Email, email)
        };

        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, SchemeName);
        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
