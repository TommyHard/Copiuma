using Microsoft.EntityFrameworkCore;
using Music.API.Models;

namespace Music.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Track> Tracks { get; set; }
}