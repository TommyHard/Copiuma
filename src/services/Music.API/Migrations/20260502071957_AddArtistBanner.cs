using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Music.API.Migrations
{
    /// <inheritdoc />
    public partial class AddArtistBanner : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BannerKey",
                table: "Artists",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BannerKey",
                table: "Artists");
        }
    }
}
