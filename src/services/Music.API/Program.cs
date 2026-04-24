using Microsoft.EntityFrameworkCore;
using Minio;
using Music.API.Auth;
using Music.API.Data;
using Music.API.Hubs;
using Music.API.Middleware;
using Music.API.Services;
using StackExchange.Redis;

namespace Music.API;

public class Program
{
    public static async Task Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

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

        builder.Services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = redisConn;
        });

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

        builder.Services.AddAuthorization();

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
        builder.Services.AddSingleton<MessageBusClient>();
        builder.Services.AddSingleton<RoomStore>();
        builder.Services.AddHostedService<TrackProcessingWorker>();
        builder.Services.AddHostedService<BucketInitializer>();

        var app = builder.Build();

        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.MigrateAsync();
        }

        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "Copiuma Music API v1");
            c.RoutePrefix = "swagger";
        });

        app.UseCors();
        app.UseAuthentication();
        app.UseAuthorization();

        app.UseMiddleware<AuditMiddleware>();

        app.MapControllers();
        app.MapHub<NotificationHub>("/notifications-hub");

        await app.RunAsync();
    }
}