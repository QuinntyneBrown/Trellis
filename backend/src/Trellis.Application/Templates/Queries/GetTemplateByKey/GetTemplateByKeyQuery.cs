using MediatR;
using Trellis.Application.Common.Models;

namespace Trellis.Application.Templates.Queries.GetTemplateByKey;

/// <summary>
/// Query to fetch a single template by its key.
/// </summary>
public record GetTemplateByKeyQuery : IRequest<TemplateDto?>
{
    /// <summary>
    /// Gets the kebab-case template key.
    /// </summary>
    public required string Key { get; init; }
}
