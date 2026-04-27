using HealthChecks.UI.Client;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Minio;
using Music.API.Auth;
using Music.API.Data;
using Music.API.HealthChecks;
using Music.API.Hubs;
using Music.API.Middleware;
using Music.API.Services;
using Music.API.Telemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Serilog.Events;
using StackExchange.Redis;

namespace Music.API;

public class Program
{
    public static async Task Main(string[] args)
    {
        // Serilog bootstrap
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Information()
            .MinimumLevel.Override("Microsoft.AspNetCore", LogEventLevel.Warning)
            .MinimumLevel.Override("Microsoft.EntityFrameworkCore", LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .Enrich.WithMachineName()
            .Enrich.WithEnvironmentName()
            .Enrich.WithThreadId()
            .Enrich.WithProperty("Service", "Music.API")
            .WriteTo.Console()
            .CreateBootstrapLogger();

        try
        {
            var builder = WebApplication.CreateBuilder(args);

            builder.Host.UseSerilog((ctx, sp, cfg) =>
            {
                cfg
                    .ReadFrom.Configuration(ctx.Configuration)
                    .ReadFrom.Services(sp)
                    .Enrich.FromLogContext()
                    .Enrich.WithMachineName()
                    .Enrich.WithEnvironmentName()
                    .Enrich.WithThreadId()
                    .Enrich.WithProperty("Service", "Music.API");

                var seqUrl = ctx.Configuration["Serilog:Seq:ServerUrl"];
                if (!string.IsNullOrWhiteSpace(seqUrl))
                    cfg.WriteTo.Seq(seqUrl);

                if (ctx.HostingEnvironment.IsDevelopment())
                {
                    cfg.WriteTo.Console(
                        outputTemplate:
                        "[{Timestamp:HH:mm:ss} {Level:u3}] {CorrelationId} {Message:lj} {Properties:j}{NewLine}{Exception}");
                }
                else
                {
                    cfg.WriteTo.Console(new Serilog.Formatting.Compact.CompactJsonFormatter());
                }
            });

            builder.Services.AddControllers();
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();

            builder.Services.AddHttpContextAccessor();
            builder.Services.AddScoped<ChangelogInterceptor>();
            builder.Services.AddDbContext<AppDbContext>((sp, options) =>
                options
                    .UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection"))
                    .AddInterceptors(sp.GetRequiredService<ChangelogInterceptor>()));

            var redisConn = builder.Configuration["Redis:Configuration"] ?? "localhost:6379";
            builder.Services.AddSingleton<IConnectionMultiplexer>(_ => ConnectionMultiplexer.Connect(redisConn));
            builder.Services.AddStackExchangeRedisCache(options => options.Configuration = redisConn);

            builder.Services.AddMinio(client => client
                .WithEndpoint(builder.Configuration["Minio:Endpoint"])
                .WithCredentials(
                    builder.Configuration["Minio:AccessKey"],
                    builder.Configuration["Minio:SecretKey"])
                .WithSSL(false)
                .Build());

            builder.Services
                .AddSignalR()
                .AddStackExchangeRedis(redisConn, opts => opts.Configuration.ChannelPrefix = "copiuma");

            builder.Services
                .AddAuthentication(GatewayUserAuthenticationHandler.SchemeName)
                .AddScheme<GatewayUserAuthenticationOptions, GatewayUserAuthenticationHandler>(
                    GatewayUserAuthenticationHandler.SchemeName, _ => { });

            builder.Services.AddControllers()
                .AddJsonOptions(options =>
                {
                    options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
                });

            // Auth-hardening: policies
            builder.Services.AddAuthorization(options =>
            {
                // DefaultPolicy Ч то, что использует [Authorize] без €вного policy-имени
                // ∆Єсткое требование: authenticated + email подтверждЄн
                options.DefaultPolicy = new AuthorizationPolicyBuilder()
                    .AddAuthenticationSchemes(GatewayUserAuthenticationHandler.SchemeName)
                    .RequireAuthenticatedUser()
                    .RequireClaim("email_verified", "true")
                    .Build();

                // ArtistOnly Ч навешиваем “ќЋ№ ќ на upload (POST /tracks/upload, future POST /albums и т.п.)
                options.AddPolicy("ArtistOnly", p => p
                    .AddAuthenticationSchemes(GatewayUserAuthenticationHandler.SchemeName)
                    .RequireAuthenticatedUser()
                    .RequireClaim("email_verified", "true")
                    .RequireRole("Artist", "Moderator", "Admin"));
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

            builder.Services.AddScoped<FileStorageService>();
            builder.Services.AddScoped<NotificationService>();
            builder.Services.AddScoped<RecommendationsService>();
            builder.Services.AddScoped<SearchService>();
            builder.Services.AddScoped<FollowFanoutService>();
            builder.Services.AddScoped<ModerationService>();
            builder.Services.AddSingleton<MessageBusClient>();
            builder.Services.AddSingleton<RoomStore>();
            builder.Services.AddHostedService<BucketInitializer>();

            // OpenTelemetry
            var otelResource = ResourceBuilder.CreateDefault()
                .AddService(
                    serviceName: "copiuma-music-api",
                    serviceVersion: typeof(Program).Assembly.GetName().Version?.ToString() ?? "1.0.0",
                    serviceInstanceId: Environment.MachineName)
                .AddAttributes(new KeyValuePair<string, object>[]
                {
                    new("deployment.environment", builder.Environment.EnvironmentName),
                });

            var otlpEndpoint = builder.Configuration["Otel:OtlpEndpoint"];
            var otelEnabled = builder.Configuration.GetValue<bool?>("Otel:Enabled") ?? true;

            if (otelEnabled)
            {
                builder.Services.AddOpenTelemetry()
                    .WithTracing(tracing =>
                    {
                        tracing
                            .SetResourceBuilder(otelResource)
                            .AddSource("Copiuma.Music.API")
                            .AddAspNetCoreInstrumentation(opts =>
                            {
                                opts.Filter = ctx =>
                                {
                                    var p = ctx.Request.Path.Value ?? string.Empty;
                                    return !p.StartsWith("/health", StringComparison.OrdinalIgnoreCase)
                                        && !p.StartsWith("/metrics", StringComparison.OrdinalIgnoreCase);
                                };
                            })
                            .AddHttpClientInstrumentation()
                            .AddEntityFrameworkCoreInstrumentation(opts =>
                            {
                                opts.SetDbStatementForText = true;
                            })
                            .AddRedisInstrumentation();

                        if (!string.IsNullOrWhiteSpace(otlpEndpoint))
                            tracing.AddOtlpExporter(o => o.Endpoint = new Uri(otlpEndpoint));
                    })
                    .WithMetrics(metrics =>
                    {
                        metrics
                            .SetResourceBuilder(otelResource)
                            .AddAspNetCoreInstrumentation()
                            .AddHttpClientInstrumentation()
                            .AddRuntimeInstrumentation()
                            .AddMeter(CopiumaMetrics.MeterName)
                            .AddPrometheusExporter();

                        if (!string.IsNullOrWhiteSpace(otlpEndpoint))
                            metrics.AddOtlpExporter(o => o.Endpoint = new Uri(otlpEndpoint));
                    });
            }

            builder.Services.AddHealthChecks()
                .AddNpgSql(
                    connectionStringFactory: _ =>
                        builder.Configuration.GetConnectionString("DefaultConnection")
                        ?? throw new InvalidOperationException("DefaultConnection не сконфигурирован"),
                    name: "postgres",
                    tags: new[] { "ready", "db" })
                .AddRedis(
                    redisConnectionString: redisConn,
                    name: "redis",
                    tags: new[] { "ready", "cache" })
                .AddCheck<MinioHealthCheck>(
                    name: "minio",
                    tags: new[] { "ready", "storage" });

            var app = builder.Build();

            using (var scope = app.Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                await db.Database.MigrateAsync();
            }

            app.UseMiddleware<CorrelationIdMiddleware>();

            app.UseSerilogRequestLogging(opts =>
            {
                opts.MessageTemplate =
                    "HTTP {RequestMethod} {RequestPath} -> {StatusCode} in {Elapsed:0.0} ms";
                opts.GetLevel = (httpCtx, _, ex) =>
                {
                    if (ex is not null) return LogEventLevel.Error;
                    if (httpCtx.Response.StatusCode >= 500) return LogEventLevel.Error;
                    if (httpCtx.Response.StatusCode >= 400) return LogEventLevel.Warning;
                    var p = httpCtx.Request.Path.Value ?? string.Empty;
                    if (p.StartsWith("/health", StringComparison.OrdinalIgnoreCase)
                        || p.StartsWith("/metrics", StringComparison.OrdinalIgnoreCase))
                        return LogEventLevel.Debug;
                    return LogEventLevel.Information;
                };
                opts.EnrichDiagnosticContext = (diag, httpCtx) =>
                {
                    diag.Set("UserAgent", httpCtx.Request.Headers.UserAgent.ToString());
                    diag.Set("ClientIP", httpCtx.Connection.RemoteIpAddress?.ToString() ?? "-");
                };
            });

            app.UseSwagger();
            app.UseSwaggerUI(c =>
            {
                c.SwaggerEndpoint("/swagger/v1/swagger.json", "Copiuma Music API v1");
                c.RoutePrefix = "swagger";
            });

            app.UseRouting();

            app.Use(async (context, next) =>
            {
                var path = context.Request.Path;
                if (path.StartsWithSegments("/notifications-hub"))
                {
                    var accessToken = context.Request.Query["access_token"];
                    if (!string.IsNullOrEmpty(accessToken) && !context.Request.Headers.ContainsKey("Authorization"))
                    {
                        context.Request.Headers.Append("Authorization", $"Bearer {accessToken}");
                    }
                }
                await next();
            });

            app.UseCors();
            app.UseAuthentication();
            app.UseAuthorization();

            app.UseMiddleware<AuditMiddleware>();

            if (otelEnabled)
                app.MapPrometheusScrapingEndpoint();

            app.MapHealthChecks("/health/live", new HealthCheckOptions
            {
                Predicate = _ => false,
                ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse,
                AllowCachingResponses = false
            });
            app.MapHealthChecks("/health/ready", new HealthCheckOptions
            {
                Predicate = check => check.Tags.Contains("ready"),
                ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse,
                AllowCachingResponses = false
            });

            app.MapControllers();
            app.MapHub<NotificationHub>("/notifications-hub");

            await app.RunAsync();
        }
        catch (Exception ex)
        {
            Log.Fatal(ex, "Music.API не смог стартовать");
            throw;
        }
        finally
        {
            await Log.CloseAndFlushAsync();
        }
    }
}