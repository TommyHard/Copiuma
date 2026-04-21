using Microsoft.EntityFrameworkCore;
using Minio;
using Music.API.Data;

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

        builder.Services.AddMinio(configureClient => configureClient
        .WithEndpoint(builder.Configuration["Minio:Endpoint"])
        .WithCredentials(
            builder.Configuration["Minio:AccessKey"],
            builder.Configuration["Minio:SecretKey"])
        .WithSSL(false)
        .Build());

        builder.Services.AddScoped<Music.API.Services.FileStorageService>();

        var app = builder.Build();

        if (app.Environment.IsDevelopment())
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }

        app.UseHttpsRedirection();

        app.UseAuthorization();

        app.MapControllers();

        app.Run();
    }
}