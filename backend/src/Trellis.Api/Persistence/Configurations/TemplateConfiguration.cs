using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Trellis.Api.Domain;

namespace Trellis.Api.Persistence.Configurations;

/// <summary>
/// Fluent configuration for the <see cref="Template"/> entity.
/// </summary>
public class TemplateConfiguration : IEntityTypeConfiguration<Template>
{
    /// <inheritdoc />
    public void Configure(EntityTypeBuilder<Template> builder)
    {
        builder.ToTable("Templates");

        builder.HasKey(template => template.Id);

        builder.Property(template => template.Name)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(template => template.Content)
            .IsRequired();

        builder.Property(template => template.Kind)
            .IsRequired()
            .HasMaxLength(16)
            .HasDefaultValue(DocumentKinds.PlantUml);

        builder.Property(template => template.CreatedAt)
            .IsRequired();

        builder.Property(template => template.UpdatedAt);
    }
}
