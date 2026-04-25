using Microsoft.EntityFrameworkCore;
using Music.AudioProcessing.Worker.Domain;
using Music.Shared.Contracts.Audio;

namespace Music.AudioProcessing.Worker.Data;

public class AudioProcessingDbContext : DbContext
{
    public AudioProcessingDbContext(DbContextOptions<AudioProcessingDbContext> options)
        : base(options) { }

    public DbSet<Track> Tracks => Set<Track>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Track>(b =>
        {
            b.ToTable("Tracks");

            b.HasKey(x => x.Id);

            b.Property(x => x.FileName).IsRequired();
            b.Property(x => x.ContentType).IsRequired();

            b.Property(x => x.AcousticFingerprint).HasMaxLength(200);

            b.Property(x => x.ProcessingStatus).HasConversion<int>();
            b.Property(x => x.HlsStatus).HasConversion<int>();
        });
    }
}