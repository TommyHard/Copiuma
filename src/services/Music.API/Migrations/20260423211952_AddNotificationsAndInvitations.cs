using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Music.API.Migrations
{
    /// <inheritdoc />
    public partial class AddNotificationsAndInvitations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Type = table.Column<string>(type: "text", nullable: false),
                    Payload = table.Column<string>(type: "jsonb", nullable: false),
                    IsRead = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "PlaylistInvitations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    PlaylistId = table.Column<Guid>(type: "uuid", nullable: false),
                    InviterId = table.Column<Guid>(type: "uuid", nullable: false),
                    InviteeId = table.Column<Guid>(type: "uuid", nullable: false),
                    ProposedRole = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PlaylistInvitations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PlaylistInvitations_Playlists_PlaylistId",
                        column: x => x.PlaylistId,
                        principalTable: "Playlists",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_UserId_IsRead_CreatedAt",
                table: "Notifications",
                columns: new[] { "UserId", "IsRead", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_PlaylistInvitations_InviteeId_Status",
                table: "PlaylistInvitations",
                columns: new[] { "InviteeId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_PlaylistInvitations_PlaylistId_InviteeId_Status",
                table: "PlaylistInvitations",
                columns: new[] { "PlaylistId", "InviteeId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Notifications");

            migrationBuilder.DropTable(
                name: "PlaylistInvitations");
        }
    }
}
