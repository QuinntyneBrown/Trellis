using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trellis.Api.Domain;

namespace Trellis.Api.Persistence.Configurations;

/// <summary>
/// Fluent configuration for the <see cref="Folder"/> entity.
/// </summary>
public class FolderConfiguration : IEntityTypeConfiguration<Folder>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Folder> builder)
    {
        builder.ToTable("Folders");

        builder.HasKey(folder => folder.Id);

        builder.Property(folder => folder.Name)
            .IsRequired()
            .HasMaxLength(200);

        // Self-referencing parent link with ON DELETE CASCADE: deleting a folder
        // deletes its whole subtree in the database engine (SQLite cascades
        // recursively, and unlike SQL Server it allows a self-referencing
        // cascade). There are deliberately no navigation properties - the
        // frontend assembles the tree from the flat list.
        builder.HasOne<Folder>()
            .WithMany()
            .HasForeignKey(folder => folder.ParentFolderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
