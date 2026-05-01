using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Music.API.Migrations
{
    /// <inheritdoc />
    public partial class PositionOfTracksInPlaylists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Position",
                table: "PlaylistTracks",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Position",
                table: "PlaylistTracks");
        }
    }
}
