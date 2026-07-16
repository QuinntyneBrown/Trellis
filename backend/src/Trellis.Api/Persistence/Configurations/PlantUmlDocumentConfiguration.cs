using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trellis.Api.Domain;

namespace Trellis.Api.Persistence.Configurations;

/// <summary>
/// Fluent configuration for the <see cref="PlantUmlDocument"/> entity.
/// </summary>
public class PlantUmlDocumentConfiguration : IEntityTypeConfiguration<PlantUmlDocument>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<PlantUmlDocument> builder)
    {
        builder.ToTable("Documents");

        builder.HasKey(document => document.Id);

        builder.Property(document => document.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(document => document.Content)
            .IsRequired();

        builder.Property(document => document.CreatedAt)
            .IsRequired();

        builder.Property(document => document.UpdatedAt);

        // The constant default both satisfies SQLite's requirement for adding
        // a NOT NULL column to an existing table and backfills pre-Kind rows
        // as PlantUML documents, which is what they all were.
        builder.Property(document => document.Kind)
            .IsRequired()
            .HasMaxLength(16)
            .HasDefaultValue(DocumentKinds.PlantUml);

        // The constant default satisfies SQLite's requirement for adding a
        // NOT NULL column to an existing table and backfills pre-existing rows
        // as included in exports, which they always were.
        builder.Property(document => document.ExcludedFromExport)
            .IsRequired()
            .HasDefaultValue(false);

        // ON DELETE CASCADE so deleting a folder deletes the documents inside it
        // (together with FolderConfiguration's self-referencing cascade, the
        // database engine wipes the whole subtree). No navigation property - the
        // relationship exists only as the FolderId column.
        builder.HasOne<Folder>()
            .WithMany()
            .HasForeignKey(document => document.FolderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
