using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Music.API.Models;

namespace Music.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    private static readonly ValueComparer<List<string>> StringListComparer = new(
        (a, b) => (a == null && b == null) || (a != null && b != null && a.SequenceEqual(b)),
        c => c.Aggregate(0, (acc, v) => HashCode.Combine(acc, v.GetHashCode())),
        c => c.ToList());

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

    public DbSet<AuditEvent> AuditEvents { get; set; }
    public DbSet<ChangeLogEntry> ChangeLogEntries { get; set; }

    public DbSet<PlayEvent> PlayEvents { get; set; }
    public DbSet<UserDislike> UserDislikes { get; set; }

    public DbSet<OfflineItem> OfflineItems { get; set; }

    public DbSet<Follow> Follows { get; set; }

    public DbSet<Report> Reports { get; set; }
    public DbSet<UserFlag> UserFlags { get; set; }

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
            b.Property(x => x.Genres)
                .HasColumnType("text[]")
                .Metadata.SetValueComparer(StringListComparer);
            b.HasIndex(x => x.Genres).HasMethod("gin");
            b.HasIndex(x => x.ReleaseDate);
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

            b.Property(x => x.Genres)
                .HasColumnType("text[]")
                .Metadata.SetValueComparer(StringListComparer);
            b.HasIndex(x => x.Genres).HasMethod("gin");
        });

        modelBuilder.Entity<AuditEvent>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Metadata).HasColumnType("jsonb");
            b.Property(x => x.Action).HasMaxLength(200);
            b.Property(x => x.Method).HasMaxLength(10);
            b.Property(x => x.Path).HasMaxLength(1000);
            b.Property(x => x.UserAgent).HasMaxLength(500);
            b.Property(x => x.IpAddress).HasMaxLength(64);
            b.Property(x => x.CorrelationId).HasMaxLength(128);
            b.HasIndex(x => new { x.UserId, x.CreatedAt });
            b.HasIndex(x => new { x.Action, x.CreatedAt });
            b.HasIndex(x => x.CreatedAt);
        });

        modelBuilder.Entity<ChangeLogEntry>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.EntityType).HasMaxLength(100);
            b.Property(x => x.Kind).HasConversion<int>();
            b.Property(x => x.Changes).HasColumnType("jsonb");
            b.HasIndex(x => new { x.EntityType, x.EntityId, x.CreatedAt });
            b.HasIndex(x => new { x.ActorUserId, x.CreatedAt });
        });

        modelBuilder.Entity<PlayEvent>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.Source).HasMaxLength(64);
            b.HasIndex(x => new { x.TrackId, x.StartedAt });
            b.HasIndex(x => new { x.UserId, x.StartedAt });
            b.HasOne(x => x.Track)
             .WithMany()
             .HasForeignKey(x => x.TrackId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<UserDislike>(b =>
        {
            b.HasKey(x => new { x.UserId, x.TargetType, x.TargetId });
            b.Property(x => x.TargetType).HasConversion<int>();
            b.HasIndex(x => new { x.UserId, x.TargetType });
        });

        modelBuilder.Entity<OfflineItem>(b =>
        {
            b.HasKey(x => new { x.UserId, x.TrackId });
            b.Property(x => x.Source).HasMaxLength(64);
            b.HasIndex(x => new { x.UserId, x.AddedAt });
            b.HasOne(x => x.Track)
             .WithMany()
             .HasForeignKey(x => x.TrackId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Follow>(b =>
        {
            b.HasKey(x => new { x.FollowerUserId, x.TargetType, x.TargetId });
            b.Property(x => x.TargetType).HasConversion<int>();
            b.HasIndex(x => new { x.TargetType, x.TargetId });
        });

        modelBuilder.Entity<Playlist>(b =>
        {
            b.Property(x => x.Visibility).HasConversion<int>();
            b.HasIndex(x => new { x.Visibility, x.CreatedAt });
        });

        // ---- Moderation ----

        modelBuilder.Entity<Track>(b =>
        {
            b.Property(x => x.DeletionReason).HasConversion<int?>();
            b.Property(x => x.ProcessingStatus).HasConversion<int>();
            b.HasIndex(x => x.DeletedAt);
            b.Property(x => x.WaveformPeaks).HasColumnType("jsonb");
            b.Property(x => x.AcousticFingerprint).HasMaxLength(200);
            b.HasIndex(x => x.AcousticFingerprint);

            b.Property(x => x.HlsStatus).HasConversion<int>();
            b.HasIndex(x => x.HlsStatus);
        });

        modelBuilder.Entity<Report>(b =>
        {
            b.HasKey(x => x.Id);
            b.Property(x => x.TargetType).HasConversion<int>();
            b.Property(x => x.Status).HasConversion<int>();
            b.Property(x => x.Reason).HasMaxLength(64);
            b.Property(x => x.Details).HasMaxLength(2000);
            b.Property(x => x.ResolutionNote).HasMaxLength(2000);
            b.HasIndex(x => new { x.Status, x.CreatedAt });
            b.HasIndex(x => new { x.TargetType, x.TargetId, x.CreatedAt });
            b.HasIndex(x => new { x.ReporterUserId, x.TargetType, x.TargetId });
        });

        modelBuilder.Entity<UserFlag>(b =>
        {
            b.HasKey(x => new { x.UserId, x.Kind });
            b.Property(x => x.Kind).HasConversion<int>();
            b.Property(x => x.Note).HasMaxLength(1000);
            b.HasIndex(x => new { x.Kind, x.ExpiresAt });
        });
    }
}