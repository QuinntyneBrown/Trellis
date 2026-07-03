using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trellis.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTemplates : Migration
    {
        /// <summary>
        /// A fixed timestamp for the seeded rows so the migration is deterministic.
        /// </summary>
        private static readonly DateTimeOffset SeedCreatedAt = new(2026, 7, 3, 0, 0, 0, TimeSpan.Zero);

        // Seed contents are the former Vendor/templates/*.puml files, embedded
        // verbatim. Built with string.Join("\n", ...) rather than raw string
        // literals so a CRLF checkout can never smuggle \r\n into the seeds
        // (the source files were LF, and File.ReadAllText kept the trailing
        // newline -- the final empty element reproduces it).
        private static readonly string BlankContent = string.Join("\n", "@startuml", "@enduml", string.Empty);

        private static readonly string SequenceContent = string.Join(
            "\n",
            "@startuml",
            "actor Customer",
            "participant \"Web App\" as Web",
            "participant \"Order Service\" as Orders",
            "database \"Order DB\" as DB",
            string.Empty,
            "Customer -> Web : Place order",
            "Web -> Orders : POST /orders",
            "Orders -> DB : Insert order",
            "DB --> Orders : Order id",
            "Orders --> Web : 201 Created",
            "Web --> Customer : Order confirmation",
            "@enduml",
            string.Empty);

        private static readonly string ClassContent = string.Join(
            "\n",
            "@startuml",
            "class Document {",
            "  +Guid Id",
            "  +string Name",
            "  +string Content",
            "  +DateTimeOffset CreatedAt",
            "  +DateTimeOffset? UpdatedAt",
            "  +Rename(name: string)",
            "}",
            string.Empty,
            "class DocumentRepository {",
            "  +GetById(id: Guid): Document",
            "  +Save(document: Document)",
            "  +Delete(id: Guid)",
            "}",
            string.Empty,
            "DocumentRepository \"1\" --> \"*\" Document : manages",
            "@enduml",
            string.Empty);

        private static readonly string C4ContextContent = string.Join(
            "\n",
            "@startuml",
            "!define RELATIVE_INCLUDE",
            "!include C4_Context.puml",
            string.Empty,
            "Person(customer, \"Customer\", \"A customer of the online shop.\")",
            "System(shop, \"Online Shop\", \"Allows customers to browse and purchase products.\")",
            "System_Ext(email, \"E-mail System\", \"Sends transactional e-mails to customers.\")",
            string.Empty,
            "Rel(customer, shop, \"Browses and places orders using\")",
            "Rel(shop, email, \"Sends order confirmations using\")",
            "Rel(email, customer, \"Delivers e-mails to\")",
            "@enduml",
            string.Empty);

        private static readonly string C4ContainerContent = string.Join(
            "\n",
            "@startuml",
            "!define RELATIVE_INCLUDE",
            "!include C4_Container.puml",
            string.Empty,
            "Person(customer, \"Customer\", \"A customer of the online shop.\")",
            string.Empty,
            "System_Boundary(shop, \"Online Shop\") {",
            "  Container(web, \"Web Application\", \"Angular\", \"Lets customers browse products and place orders.\")",
            "  Container(api, \"API Application\", \"ASP.NET Core\", \"Serves the shop's REST and real-time API.\")",
            "  ContainerDb(db, \"Database\", \"SQLite\", \"Stores orders and product data.\")",
            "}",
            string.Empty,
            "Rel(customer, web, \"Uses\", \"HTTPS\")",
            "Rel(web, api, \"Calls\", \"JSON/HTTPS\")",
            "Rel(api, db, \"Reads from and writes to\", \"SQL\")",
            "@enduml",
            string.Empty);

        private static readonly string C4ComponentContent = string.Join(
            "\n",
            "@startuml",
            "!define RELATIVE_INCLUDE",
            "!include C4_Component.puml",
            string.Empty,
            "Container(web, \"Web Application\", \"Angular\", \"Lets customers browse products and place orders.\")",
            "ContainerDb(db, \"Database\", \"SQLite\", \"Stores orders and product data.\")",
            string.Empty,
            "Container_Boundary(api, \"API Application\") {",
            "  Component(controller, \"Orders Controller\", \"ASP.NET Core Controller\", \"Handles order REST requests.\")",
            "  Component(handler, \"Place Order Handler\", \"MediatR Handler\", \"Validates and creates a new order.\")",
            "  Component(repository, \"Order Repository\", \"EF Core\", \"Reads and writes order data.\")",
            "}",
            string.Empty,
            "Rel(web, controller, \"Calls\", \"JSON/HTTPS\")",
            "Rel(controller, handler, \"Dispatches to\")",
            "Rel(handler, repository, \"Uses\")",
            "Rel(repository, db, \"Reads from and writes to\", \"SQL\")",
            "@enduml",
            string.Empty);

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Templates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Content = table.Column<string>(type: "TEXT", nullable: false),
                    Kind = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false, defaultValue: "plantuml"),
                    CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Templates", x => x.Id);
                });

            // The six built-in starters, seeded as ordinary rows: renameable,
            // updatable, deletable like any user template. Seeding here (not
            // seed-if-empty at startup) means a deleted built-in never
            // resurrects -- the migrations history records this as applied.
            migrationBuilder.InsertData(
                table: "Templates",
                columns: new[] { "Id", "Name", "Content", "Kind", "CreatedAt", "UpdatedAt" },
                values: new object?[,]
                {
                    { new Guid("5b9e6f01-3a7c-4d2e-9f10-84a1c2d3e401"), "Blank", BlankContent, "plantuml", SeedCreatedAt, null },
                    { new Guid("5b9e6f01-3a7c-4d2e-9f10-84a1c2d3e402"), "Sequence Diagram", SequenceContent, "plantuml", SeedCreatedAt, null },
                    { new Guid("5b9e6f01-3a7c-4d2e-9f10-84a1c2d3e403"), "Class Diagram", ClassContent, "plantuml", SeedCreatedAt, null },
                    { new Guid("5b9e6f01-3a7c-4d2e-9f10-84a1c2d3e404"), "C4 - Context", C4ContextContent, "plantuml", SeedCreatedAt, null },
                    { new Guid("5b9e6f01-3a7c-4d2e-9f10-84a1c2d3e405"), "C4 - Container", C4ContainerContent, "plantuml", SeedCreatedAt, null },
                    { new Guid("5b9e6f01-3a7c-4d2e-9f10-84a1c2d3e406"), "C4 - Component", C4ComponentContent, "plantuml", SeedCreatedAt, null },
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Templates");
        }
    }
}
