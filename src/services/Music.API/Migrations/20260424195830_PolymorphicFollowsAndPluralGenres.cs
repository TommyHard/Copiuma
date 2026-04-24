using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Music.API.Migrations
{
    /// <inheritdoc />
    public partial class PolymorphicFollowsAndPluralGenres : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Follows_Artists_ArtistId",
                table: "Follows");

            migrationBuilder.DropIndex(
                name: "IX_Tracks_Genre",
                table: "Tracks");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Follows",
                table: "Follows");

            migrationBuilder.DropIndex(
                name: "IX_Follows_ArtistId",
                table: "Follows");

            migrationBuilder.DropIndex(
                name: "IX_Albums_Genre",
                table: "Albums");

            migrationBuilder.DropColumn(
                name: "Genre",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "Genre",
                table: "Albums");

            migrationBuilder.RenameColumn(
                name: "ArtistId",
                table: "Follows",
                newName: "TargetId");

            migrationBuilder.AddColumn<string>(
                name: "AcousticFingerprint",
                table: "Tracks",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "Tracks",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DeletionReason",
                table: "Tracks",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<List<string>>(
                name: "Genres",
                table: "Tracks",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsExplicit",
                table: "Tracks",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "LoudnessLufs",
                table: "Tracks",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ProcessingStatus",
                table: "Tracks",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<List<float>>(
                name: "WaveformPeaks",
                table: "Tracks",
                type: "jsonb",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TargetType",
                table: "Follows",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<List<string>>(
                name: "Genres",
                table: "Albums",
                type: "text[]",
                nullable: false);

            migrationBuilder.AddPrimaryKey(
                name: "PK_Follows",
                table: "Follows",
                columns: new[] { "FollowerUserId", "TargetType", "TargetId" });

            migrationBuilder.CreateTable(
                name: "Reports",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ReporterUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetType = table.Column<int>(type: "integer", nullable: false),
                    TargetId = table.Column<Guid>(type: "uuid", nullable: false),
                    Reason = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    Details = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ResolvedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    ResolvedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ResolutionNote = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reports", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserFlags",
                columns: table => new
                {
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Kind = table.Column<int>(type: "integer", nullable: false),
                    SetByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SetAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserFlags", x => new { x.UserId, x.Kind });
                });

            migrationBuilder.CreateIndex(
                name: "IX_Tracks_AcousticFingerprint",
                table: "Tracks",
                column: "AcousticFingerprint");

            migrationBuilder.CreateIndex(
                name: "IX_Tracks_DeletedAt",
                table: "Tracks",
                column: "DeletedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Tracks_Genres",
                table: "Tracks",
                column: "Genres")
                .Annotation("Npgsql:IndexMethod", "gin");

            migrationBuilder.CreateIndex(
                name: "IX_Follows_TargetType_TargetId",
                table: "Follows",
                columns: new[] { "TargetType", "TargetId" });

            migrationBuilder.CreateIndex(
                name: "IX_Albums_Genres",
                table: "Albums",
                column: "Genres")
                .Annotation("Npgsql:IndexMethod", "gin");

            migrationBuilder.CreateIndex(
                name: "IX_Reports_ReporterUserId_TargetType_TargetId",
                table: "Reports",
                columns: new[] { "ReporterUserId", "TargetType", "TargetId" });

            migrationBuilder.CreateIndex(
                name: "IX_Reports_Status_CreatedAt",
                table: "Reports",
                columns: new[] { "Status", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_Reports_TargetType_TargetId_CreatedAt",
                table: "Reports",
                columns: new[] { "TargetType", "TargetId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_UserFlags_Kind_ExpiresAt",
                table: "UserFlags",
                columns: new[] { "Kind", "ExpiresAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Reports");

            migrationBuilder.DropTable(
                name: "UserFlags");

            migrationBuilder.DropIndex(
                name: "IX_Tracks_AcousticFingerprint",
                table: "Tracks");

            migrationBuilder.DropIndex(
                name: "IX_Tracks_DeletedAt",
                table: "Tracks");

            migrationBuilder.DropIndex(
                name: "IX_Tracks_Genres",
                table: "Tracks");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Follows",
                table: "Follows");

            migrationBuilder.DropIndex(
                name: "IX_Follows_TargetType_TargetId",
                table: "Follows");

            migrationBuilder.DropIndex(
                name: "IX_Albums_Genres",
                table: "Albums");

            migrationBuilder.DropColumn(
                name: "AcousticFingerprint",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "DeletionReason",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "Genres",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "IsExplicit",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "LoudnessLufs",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "ProcessingStatus",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "WaveformPeaks",
                table: "Tracks");

            migrationBuilder.DropColumn(
                name: "TargetType",
                table: "Follows");

            migrationBuilder.DropColumn(
                name: "Genres",
                table: "Albums");

            migrationBuilder.RenameColumn(
                name: "TargetId",
                table: "Follows",
                newName: "ArtistId");

            migrationBuilder.AddColumn<string>(
                name: "Genre",
                table: "Tracks",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Genre",
                table: "Albums",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_Follows",
                table: "Follows",
                columns: new[] { "FollowerUserId", "ArtistId" });

            migrationBuilder.CreateIndex(
                name: "IX_Tracks_Genre",
                table: "Tracks",
                column: "Genre");

            migrationBuilder.CreateIndex(
                name: "IX_Follows_ArtistId",
                table: "Follows",
                column: "ArtistId");

            migrationBuilder.CreateIndex(
                name: "IX_Albums_Genre",
                table: "Albums",
                column: "Genre");

            migrationBuilder.AddForeignKey(
                name: "FK_Follows_Artists_ArtistId",
                table: "Follows",
                column: "ArtistId",
                principalTable: "Artists",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
