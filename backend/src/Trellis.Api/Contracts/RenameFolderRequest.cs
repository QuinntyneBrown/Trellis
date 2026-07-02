using System.ComponentModel.DataAnnotations;

namespace Trellis.Api.Contracts;

/// <summary>
/// The JSON request body for the rename-folder endpoint. Renaming is the only
/// supported folder update - folders cannot be re-parented.
/// </summary>
public record RenameFolderRequest
{
    /// <summary>
    /// Gets the new display name of the folder.
    /// </summary>
    [Required]
    [MaxLength(200)]
    public required string Name { get; init; }
}
