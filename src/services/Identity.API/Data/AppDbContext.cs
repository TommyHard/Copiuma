using Identity.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Identity.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    public DbSet<UserPreferences> UserPreferences { get; set; }
    public DbSet<EmailVerificationToken> EmailVerificationTokens { get; set; }
    public DbSet<PasswordResetToken> PasswordResetTokens { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<User>(b =>
        {
            b.HasIndex(u => u.Email).IsUnique();
            b.Property(u => u.Role).HasConversion<int>();
            b.Property(u => u.Bio).HasMaxLength(500);
            b.Property(u => u.AvatarKey).HasMaxLength(500);

            b.HasOne(u => u.Preferences)
             .WithOne(p => p.User)
             .HasForeignKey<UserPreferences>(p => p.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(u => u.RefreshTokens)
             .WithOne(rt => rt.User)
             .HasForeignKey(rt => rt.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(u => u.EmailVerificationTokens)
             .WithOne(t => t.User)
             .HasForeignKey(t => t.UserId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(u => u.PasswordResetTokens)
             .WithOne(t => t.User)
             .HasForeignKey(t => t.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<RefreshToken>(b =>
        {
            b.HasIndex(t => t.TokenHash).IsUnique();
            b.HasIndex(t => new { t.UserId, t.IsRevoked });
            b.Property(t => t.IpAddress).HasMaxLength(64);
            b.Property(t => t.UserAgent).HasMaxLength(512);
            b.Property(t => t.DeviceLabel).HasMaxLength(128);
        });

        modelBuilder.Entity<EmailVerificationToken>(b =>
        {
            b.HasIndex(t => t.TokenHash).IsUnique();
            b.HasIndex(t => t.UserId);
            b.Property(t => t.TokenHash).HasMaxLength(64);
        });

        modelBuilder.Entity<PasswordResetToken>(b =>
        {
            b.HasIndex(t => t.TokenHash).IsUnique();
            b.HasIndex(t => t.UserId);
            b.Property(t => t.TokenHash).HasMaxLength(64);
        });
    }
}