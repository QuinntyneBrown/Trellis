using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trellis.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentKind : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "Documents",
                type: "TEXT",
                maxLength: 16,
                nullable: false,
                defaultValue: "plantuml");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Kind",
                table: "Documents");
        }
    }
}
