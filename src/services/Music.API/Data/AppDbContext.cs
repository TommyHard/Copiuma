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

    public DbSet<TrackRating> TrackRatings { get; set; }
    public DbSet<TrackReview> TrackReviews { get; set; }
    public DbSet<ReviewLike> ReviewLikes { get; set; }

    public DbSet<Artist> Artists { get; set; }
    public DbSet<Album> Albums { get; set; }

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

        modelBuilder.Entity<TrackRating>(b =>
        {
            b.HasKey(x => new { x.UserId, x.TrackId });
            b.HasIndex(x => x.TrackId);
            b.Property(x => x.Value)
             .HasAnnotation("MinValue", 1)
             .HasAnnotation("MaxValue", 5);
            b.ToTable(t => t.HasCheckConstraint("CK_TrackRating_Value_1_5", "\"Value\" BETWEEN 1 AND 5"));
            b.HasOne(x => x.Track)
             .WithMany()
             .HasForeignKey(x => x.TrackId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TrackReview>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Text).HasMaxLength(4000);
            b.HasIndex(x => new { x.TrackId, x.IsDeleted, x.CreatedAt });
            b.HasIndex(x => new { x.AuthorId, x.CreatedAt });
            b.HasOne(x => x.Track)
             .WithMany()
             .HasForeignKey(x => x.TrackId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ReviewLike>(b =>
        {
            b.HasKey(x => new { x.ReviewId, x.UserId });
            b.HasIndex(x => x.ReviewId);
            b.HasOne(x => x.Review)
             .WithMany()
             .HasForeignKey(x => x.ReviewId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Artist>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Name).HasMaxLength(200);
            b.Property(x => x.Bio).HasMaxLength(4000);
            b.HasIndex(x => x.Name);
        });

        modelBuilder.Entity<Artist>()
            .HasGeneratedTsVectorColumn(
                a => a.SearchVector,
                "russian",
                a => new { a.Name })
            .HasIndex(a => a.SearchVector)
            .HasMethod("GIN");

        modelBuilder.Entity<Album>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Title).HasMaxLength(200);
            b.HasIndex(x => x.ArtistId);
            b.HasIndex(x => new { x.ArtistId, x.Title });
            b.HasOne(x => x.Artist)
             .WithMany()
             .HasForeignKey(x => x.ArtistId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Album>()
            .HasGeneratedTsVectorColumn(
                a => a.SearchVector,
                "russian",
                a => new { a.Title })
            .HasIndex(a => a.SearchVector)
            .HasMethod("GIN");

        modelBuilder.Entity<Track>(b =>
        {
            b.HasOne(x => x.ArtistEntity)
             .WithMany()
             .HasForeignKey(x => x.ArtistId)
             .OnDelete(DeleteBehavior.SetNull);
            b.HasOne(x => x.Album)
             .WithMany()
             .HasForeignKey(x => x.AlbumId)
             .OnDelete(DeleteBehavior.SetNull);
            b.HasIndex(x => x.ArtistId);
            b.HasIndex(x => new { x.AlbumId, x.TrackNumber });
        });
    }
}