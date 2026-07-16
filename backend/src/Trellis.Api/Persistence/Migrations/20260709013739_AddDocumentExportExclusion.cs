using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trellis.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDocumentExportExclusion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ExcludedFromExport",
                table: "Documents",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ExcludedFromExport",
                table: "Documents");
        }
    }
}
