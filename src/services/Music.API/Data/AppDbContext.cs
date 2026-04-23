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
    public DbSet<PlaylistMember> PlaylistMembers { get; set; }

    public DbSet<PlaylistInvitation> PlaylistInvitations { get; set; }
    public DbSet<Notification> Notifications { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<PlaylistTrack>()
            .HasKey(pt => new { pt.PlaylistId, pt.TrackId });

        modelBuilder.Entity<PlaylistMember>()
            .HasKey(pm => new { pm.PlaylistId, pm.UserId });

        modelBuilder.Entity<Track>()
            .HasGeneratedTsVectorColumn(
                t => t.SearchVector,
                "russian",
                t => new { t.Title, t.Artist })
            .HasIndex(t => t.SearchVector)
            .HasMethod("GIN");

        modelBuilder.Entity<Notification>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Payload).HasColumnType("jsonb");
            b.HasIndex(x => new { x.UserId, x.IsRead, x.CreatedAt });
        });

        modelBuilder.Entity<PlaylistInvitation>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Status).HasConversion<int>();
            b.Property(x => x.ProposedRole).HasConversion<int>();
            b.HasIndex(x => new { x.InviteeId, x.Status });
            b.HasIndex(x => new { x.PlaylistId, x.InviteeId, x.Status });
            b.HasOne(x => x.Playlist)
             .WithMany()
             .HasForeignKey(x => x.PlaylistId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }
}