namespace Trellis.Api.Contracts;

/// <summary>
/// The JSON request body accepted by the update-document endpoint. Deliberately
/// omits an id field - the route id is always authoritative.
/// </summary>
public record UpdateDocumentRequestBody
{
    /// <summary>
    /// Gets the new display name of the document.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Gets the new PlantUML source content.
    /// </summary>
    public required string Content { get; init; }
}
