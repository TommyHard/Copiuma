using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Yarp.ReverseProxy.Transforms;
using StackExchange.Redis;

namespace Gateway.API;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.WebHost.ConfigureKestrel(options =>
        {
            options.Limits.MaxRequestBodySize = 200_000_000;
        });

        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                             ?? new[] { "http://localhost:3000" };

        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                policy.WithOrigins(allowedOrigins)
                      .AllowAnyHeader()
                      .AllowAnyMethod()
                      .AllowCredentials();
            });
        });

        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo { Title = "Copiuma Gateway", Version = "v1" });
            options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.ApiKey,
                Scheme = "Bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description = "¬ведите токен в формате: Bearer {токен}"
            });
            options.AddSecurityRequirement(new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
                    },
                    Array.Empty<string>()
                }
            });
        });

        // con. Redis к шлюзу
        var redisConn = builder.Configuration["Redis:Configuration"] ?? "localhost:6379";

        // √нида живи
        if (!redisConn.Contains("abortConnect", StringComparison.OrdinalIgnoreCase))
        {
            redisConn = $"{redisConn},abortConnect=false";
        }

        builder.Services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConn));

        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:Key"]!)),
                    ValidateIssuer = true,
                    ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
                    ValidateAudience = true,
                    ValidAudience = builder.Configuration["JwtSettings:Audience"],
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30)
                };
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        var accessToken = context.Request.Query["access_token"];
                        var path = context.HttpContext.Request.Path;
                        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/api/notifications-hub"))
                        {
                            context.Token = accessToken;
                        }
                        return Task.CompletedTask;
                    }
                };
            });

        builder.Services.AddAuthorization(options =>
        {
            options.AddPolicy("AuthenticatedUser", policy => policy.RequireAuthenticatedUser());
        });

        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(ctx =>
                RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey: ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
                    factory: _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 100,
                        Window = TimeSpan.FromSeconds(10),
                        QueueLimit = 0,
                        AutoReplenishment = true
                    }));
        });

        builder.Services.AddReverseProxy()
            .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"))
            .AddTransforms(builderContext =>
            {
                builderContext.AddRequestTransform(transformContext =>
                {
                    var user = transformContext.HttpContext.User;
                    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier);
                    var email = user.FindFirstValue(ClaimTypes.Email);
                    var displayName = user.FindFirstValue("DisplayName");
                    var role = user.FindFirstValue(ClaimTypes.Role);
                    var emailVerified = user.FindFirstValue("email_verified");

                    var headers = transformContext.ProxyRequest.Headers;
                    headers.Remove("X-User-Id");
                    headers.Remove("X-User-Email");
                    headers.Remove("X-User-Name");
                    headers.Remove("X-User-Role");
                    headers.Remove("X-User-Email-Verified");

                    if (!string.IsNullOrEmpty(userId))
                    {
                        headers.Add("X-User-Id", userId);
                        if (!string.IsNullOrEmpty(email))
                            headers.Add("X-User-Email", email);
                        if (!string.IsNullOrEmpty(displayName))
                            headers.Add("X-User-Name", displayName);
                        if (!string.IsNullOrEmpty(role))
                            headers.Add("X-User-Role", role);
                        if (!string.IsNullOrEmpty(emailVerified))
                            headers.Add("X-User-Email-Verified", emailVerified);
                    }

                    return ValueTask.CompletedTask;
                });
            });

        var app = builder.Build();

        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "Copiuma API v1");
            c.RoutePrefix = "swagger";
        });

        app.UseCors();
        app.UseRateLimiter();
        app.UseAuthentication();

        app.Use(async (context, next) =>
        {
            if (context.User.Identity?.IsAuthenticated == true)
            {
                var sessionId = context.User.FindFirst("SessionId")?.Value;
                if (!string.IsNullOrEmpty(sessionId))
                {
                    var redis = context.RequestServices.GetRequiredService<IConnectionMultiplexer>();
                    var db = redis.GetDatabase();

                    var isSessionActive = await db.KeyExistsAsync($"active_session:{sessionId}");

                    if (!isSessionActive)
                    {
                        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                        return;
                    }
                }
            }
            await next();
        });

        app.UseAuthorization();
        app.MapReverseProxy();
        app.Run();
    }
}