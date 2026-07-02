using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Trellis.Api.Contracts;
using Trellis.Api.Domain;
using Trellis.Api.Persistence;

namespace Trellis.Api.Controllers;

/// <summary>
/// Exposes CRUD operations over the virtual folders used to organize documents.
/// The API is deliberately flat - the frontend assembles the folder tree
/// client-side from the plain list, so there is no tree endpoint and no
/// GET-by-id (the list already carries everything a folder has).
/// </summary>
[ApiController]
[Route("api/folders")]
public class FoldersController : ControllerBase
{
    private readonly ApplicationDbContext context;

    /// <summary>
    /// Initializes a new instance of the <see cref="FoldersController"/> class.
    /// </summary>
    /// <param name="context">The application database context.</param>
    public FoldersController(ApplicationDbContext context)
    {
        this.context = context;
    }

    /// <summary>
    /// Gets every folder as a flat list. No server-side ordering is applied -
    /// tree assembly and sorting are client-side concerns.
    /// </summary>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The list of folders.</returns>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Folder>>> GetList(CancellationToken cancellationToken)
    {
        var folders = await this.context.Folders
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return this.Ok(folders);
    }

    /// <summary>
    /// Creates a new folder, optionally nested inside a parent folder.
    /// </summary>
    /// <param name="request">The folder to create.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The created folder, or 404 if the parent folder does not exist.</returns>
    [HttpPost]
    public async Task<ActionResult<Folder>> Create(CreateFolderRequest request, CancellationToken cancellationToken)
    {
        // Checked explicitly (mirroring DocumentsController.Create's folder guard)
        // so a stale parent id yields a 404 rather than a SQLite FK violation -> 500.
        if (request.ParentFolderId.HasValue
            && !await this.context.Folders.AnyAsync(f => f.Id == request.ParentFolderId.Value, cancellationToken))
        {
            return this.NotFound();
        }

        var folder = new Folder
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            ParentFolderId = request.ParentFolderId,
        };

        this.context.Folders.Add(folder);
        await this.context.SaveChangesAsync(cancellationToken);

        // Created(...) rather than CreatedAtAction: there is deliberately no
        // GET /api/folders/{id} action to point at (see the class doc comment).
        return this.Created($"/api/folders/{folder.Id}", folder);
    }

    /// <summary>
    /// Renames a folder. Renaming is the only supported update - folders cannot
    /// be re-parented.
    /// </summary>
    /// <param name="id">The identifier of the folder to rename.</param>
    /// <param name="request">The new name.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The renamed folder, or 404 if it does not exist.</returns>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Folder>> Rename(Guid id, RenameFolderRequest request, CancellationToken cancellationToken)
    {
        var folder = await this.context.Folders
            .FirstOrDefaultAsync(f => f.Id == id, cancellationToken);

        if (folder is null)
        {
            return this.NotFound();
        }

        folder.Name = request.Name;
        await this.context.SaveChangesAsync(cancellationToken);

        return this.Ok(folder);
    }

    /// <summary>
    /// Deletes a folder together with everything inside it: the database's
    /// ON DELETE CASCADE constraints (see FolderConfiguration and
    /// PlantUmlDocumentConfiguration) recursively remove all contained
    /// subfolders and documents from this single row deletion.
    /// </summary>
    /// <param name="id">The identifier of the folder to delete.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>204 No Content, or 404 if it does not exist.</returns>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var folder = await this.context.Folders
            .FirstOrDefaultAsync(f => f.Id == id, cancellationToken);

        if (folder is null)
        {
            return this.NotFound();
        }

        this.context.Folders.Remove(folder);
        await this.context.SaveChangesAsync(cancellationToken);

        return this.NoContent();
    }
}
