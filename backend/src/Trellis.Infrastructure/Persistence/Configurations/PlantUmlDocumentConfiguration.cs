using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trellis.Domain.Entities;

namespace Trellis.Infrastructure.Persistence.Configurations;

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
    }
}
