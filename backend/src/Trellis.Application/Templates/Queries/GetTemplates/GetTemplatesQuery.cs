using MediatR;
using Trellis.Application.Common.Models;

namespace Trellis.Application.Templates.Queries.GetTemplates;

/// <summary>
/// Query to fetch every available PlantUML starter template.
/// </summary>
public record GetTemplatesQuery : IRequest<IReadOnlyList<TemplateDto>>;
