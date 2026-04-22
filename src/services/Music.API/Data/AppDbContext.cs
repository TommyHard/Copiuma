using Microsoft.EntityFrameworkCore;
using Music.API.Models;

namespace Music.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Track> Tracks { get; set; }
    public DbSet<LikedTrack> LikedTracks { get; set; }

    public DbSet<Playlist> Playlists { get; set; }
    public DbSet<PlaylistTrack> PlaylistTracks { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<PlaylistTrack>()
            .HasKey(pt => new { pt.PlaylistId, pt.TrackId });

        modelBuilder.Entity<Track>()
            .HasGeneratedTsVectorColumn(
                t => t.SearchVector,
                "russian",
                t => new { t.Title, t.Artist })
            .HasIndex(t => t.SearchVector)
            .HasMethod("GIN");
    }
}