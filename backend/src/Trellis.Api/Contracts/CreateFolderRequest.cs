using System.ComponentModel.DataAnnotations;

namespace Trellis.Api.Contracts;

/// <summary>
/// The JSON request body for the create-folder endpoint.
/// </summary>
public record CreateFolderRequest
{
    /// <summary>
    /// Gets the display name of the folder.
    /// </summary>
    [Required]
    [MaxLength(200)]
    public required string Name { get; init; }

    /// <summary>
    /// Gets the identifier of the parent folder, or null to create the folder
    /// at the root.
    /// </summary>
    public Guid? ParentFolderId { get; init; }
}
