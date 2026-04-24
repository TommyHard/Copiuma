using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Music.API.Migrations
{
    /// <inheritdoc />
    public partial class AddOfflineDownloads : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OfflineItems",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TrackId = table.Column<Guid>(type: "uuid", nullable: false),
                    Source = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    AddedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    LastDownloadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OfflineItems", x => new { x.UserId, x.TrackId });
                    table.ForeignKey(
                        name: "FK_OfflineItems_Tracks_TrackId",
                        column: x => x.TrackId,
                        principalTable: "Tracks",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserDislikes",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetType = table.Column<int>(type: "integer", nullable: false),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserDislikes", x => new { x.UserId, x.TargetType, x.TargetId });
                });

            migrationBuilder.CreateIndex(
                name: "IX_OfflineItems_TrackId",
                table: "OfflineItems",
                column: "TrackId");

            migrationBuilder.CreateIndex(
                name: "IX_OfflineItems_UserId_AddedAt",
                table: "OfflineItems",
                columns: new[] { "UserId", "AddedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UserDislikes_UserId_TargetType",
                table: "UserDislikes",
                columns: new[] { "UserId", "TargetType" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OfflineItems");

            migrationBuilder.DropTable(
                name: "UserDislikes");
        }
    }
}
