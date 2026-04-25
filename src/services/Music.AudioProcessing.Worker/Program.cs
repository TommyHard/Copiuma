using HealthChecks.UI.Client;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Minio;
using Music.AudioProcessing.Worker.Audio;
using Music.AudioProcessing.Worker.Data;
using Music.AudioProcessing.Worker.HealthChecks;
using Music.AudioProcessing.Worker.Hls;
using Music.AudioProcessing.Worker.Loudnorm;
using Music.AudioProcessing.Worker.Messaging;
using Music.AudioProcessing.Worker.Pipeline;
using Music.AudioProcessing.Worker.Recovery;
using Music.AudioProcessing.Worker.Storage;
using Music.AudioProcessing.Worker.Telemetry;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using Serilog;
using Serilog.Events;

namespace Music.AudioProcessing.Worker;

public class Program
{
    public static async Task Main(string[] args)
    {
        Log.Logger = new LoggerConfiguration()
            .MinimumLevel.Information()
            .Enrich.FromLogContext()
            .Enrich.WithMachineName()
            .Enrich.WithEnvironmentName()
            .Enrich.WithProperty("Service", "Music.AudioProcessing.Worker")
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
                    .Enrich.WithProperty("Service", "Music.AudioProcessing.Worker");

                var seqUrl = ctx.Configuration["Serilog:Seq:ServerUrl"];
                if (!string.IsNullOrWhiteSpace(seqUrl))
                    cfg.WriteTo.Seq(seqUrl);

                if (ctx.HostingEnvironment.IsDevelopment())
                {
                    cfg.WriteTo.Console(
                        outputTemplate:
                        "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}");
                }
                else
                {
                    cfg.WriteTo.Console(new Serilog.Formatting.Compact.CompactJsonFormatter());
                }
            });

            // DB
            builder.Services.AddDbContext<AudioProcessingDbContext>(options =>
                options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

            // MinIO
            builder.Services.AddMinio(client => client
                .WithEndpoint(builder.Configuration["Minio:Endpoint"])
                .WithCredentials(
                    builder.Configuration["Minio:AccessKey"],
                    builder.Configuration["Minio:SecretKey"])
                .WithSSL(false)
                .Build());
            builder.Services.AddScoped<AudioStorageService>();

            // Audio analysis
            var analyzerType = builder.Configuration["AudioAnalyzer:Type"]?.ToLowerInvariant() ?? "ffmpeg";
            if (analyzerType == "stub")
                builder.Services.AddSingleton<IAudioAnalyzer, StubAudioAnalyzer>();
            else
                builder.Services.AddSingleton<IAudioAnalyzer, FFMpegAudioAnalyzer>();

            // HLS
            var hlsEnabled = builder.Configuration.GetValue<bool?>("Hls:Enabled") ?? true;
            if (hlsEnabled)
                builder.Services.AddScoped<IHlsTranscoder, HlsTranscoder>();

            // Loudnorm (OFF by default)
            var loudnormEnabled = builder.Configuration.GetValue<bool?>("Loudnorm:Enabled") ?? false;
            if (loudnormEnabled)
                builder.Services.AddSingleton<ILoudnormService, FFMpegLoudnormService>();

            // Pipeline
            builder.Services.AddScoped<AudioPipeline>();

            // Messaging
            builder.Services.AddSingleton<RabbitConnection>();
            builder.Services.AddSingleton<AudioJobPublisher>();
            builder.Services.AddHostedService<AudioJobConsumer>();
            builder.Services.AddHostedService<StuckTracksRecoveryService>();

            // OpenTelemetry
            var otelEnabled = builder.Configuration.GetValue<bool?>("Otel:Enabled") ?? true;
            var otlpEndpoint = builder.Configuration["Otel:OtlpEndpoint"];

            var otelResource = ResourceBuilder.CreateDefault()
                .AddService(
                    serviceName: "copiuma-audio-processing-worker",
                    serviceVersion: typeof(Program).Assembly.GetName().Version?.ToString() ?? "1.0.0",
                    serviceInstanceId: Environment.MachineName)
                .AddAttributes(new KeyValuePair<string, object>[]
                {
                    new("deployment.environment", builder.Environment.EnvironmentName),
                });

            if (otelEnabled)
            {
                builder.Services.AddOpenTelemetry()
                    .WithTracing(tracing =>
                    {
                        tracing
                            .SetResourceBuilder(otelResource)
                            .AddSource("Copiuma.Music.AudioProcessing")
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
                            });

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
                .AddCheck<MinioHealthCheck>(
                    name: "minio",
                    tags: new[] { "ready", "storage" })
                .AddCheck<RabbitMqHealthCheck>(
                    name: "rabbitmq",
                    tags: new[] { "ready", "messaging" });

            var app = builder.Build();

            app.UseSerilogRequestLogging(opts =>
            {
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
            });

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

            app.MapGet("/", () => Results.Ok(new
            {
                service = "Music.AudioProcessing.Worker",
                health = "/health/live",
                ready = "/health/ready",
                metrics = otelEnabled ? "/metrics" : null
            }));

            await app.RunAsync();
        }
        catch (Exception ex)
        {
            Log.Fatal(ex, "Music.AudioProcessing.Worker не смог стартовать");
            throw;
        }
        finally
        {
            await Log.CloseAndFlushAsync();
        }
    }
}