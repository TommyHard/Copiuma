using Microsoft.EntityFrameworkCore;
using Minio;
using Music.API.Data;
using Music.API.Services;

namespace Music.API;

public class Program
{
    public static void Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Services.AddControllers();
        builder.Services.AddEndpointsApiExplorer();
        builder.Services.AddSwaggerGen();
        
        builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

        builder.Services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = builder.Configuration["Redis:Configuration"];
        });

        builder.Services.AddMinio(configureClient => configureClient
        .WithEndpoint(builder.Configuration["Minio:Endpoint"])
        .WithCredentials(
            builder.Configuration["Minio:AccessKey"],
            builder.Configuration["Minio:SecretKey"])
        .WithSSL(false)
        .Build());

        builder.Services.AddSignalR();
        builder.Services.AddCors(options =>
        {
            options.AddDefaultPolicy(policy =>
            {
                policy.AllowAnyHeader()
                      .AllowAnyMethod()
                      .SetIsOriginAllowed(_ => true)
                      .AllowCredentials();
            });
        });

        builder.Services.AddScoped<Music.API.Services.FileStorageService>();
        builder.Services.AddSingleton<MessageBusClient>();
        builder.Services.AddHostedService<TrackProcessingWorker>();

        var app = builder.Build();

        app.UseSwagger();
        app.UseSwaggerUI(c =>
        {
            c.SwaggerEndpoint("/swagger/v1/swagger.json", "Copiuma API v1");
            c.RoutePrefix = "swagger";
        });

        app.UseHttpsRedirection();

        app.UseCors();

        app.UseAuthorization();

        app.MapControllers();

        app.MapHub<Music.API.Hubs.NotificationHub>("/notifications");

        app.Run();
    }
}