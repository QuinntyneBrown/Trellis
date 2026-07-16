using System.Text;
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
    /// <summary>The document name (case-insensitive) that renders first in a folder's export.</summary>
    private const string IndexDocumentName = "index";

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

    /// <summary>
    /// Exports a folder and all of its descendant folders as one aggregated
    /// markdown document. The markdown format is the contract: folder and
    /// document names never appear in the output - only document content.
    /// Within a folder, a document named "index" (case-insensitive) comes
    /// first, then the subfolders' content, then the remaining documents
    /// sorted case-insensitively by name (mirroring the documents panel's
    /// display order). Markdown documents are inlined verbatim; PlantUML
    /// documents are wrapped in a ```plantuml fenced code block. A wholly
    /// empty export returns just an italic "no documents" note. Sections are
    /// separated by blank lines and line endings are normalized to LF.
    /// Documents marked as excluded from export are omitted unless
    /// <paramref name="includeExcluded"/> is true.
    /// </summary>
    /// <param name="id">The identifier of the folder to export.</param>
    /// <param name="includeExcluded">Whether to include documents marked as excluded from export.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The aggregated markdown as text/markdown, or 404 if the folder does not exist.</returns>
    [HttpGet("{id:guid}/export")]
    public async Task<IActionResult> Export(Guid id, [FromQuery] bool includeExcluded, CancellationToken cancellationToken)
    {
        var folders = await this.context.Folders
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var root = folders.FirstOrDefault(f => f.Id == id);
        if (root is null)
        {
            return this.NotFound();
        }

        // In-memory BFS over the flat list (there are no navigation
        // properties), with a visited set so corrupt parent cycles cannot
        // hang the walk - the backend twin of the frontend's
        // collectDescendantFolderIds.
        var subtreeIds = new HashSet<Guid> { root.Id };
        var queue = new Queue<Guid>();
        queue.Enqueue(root.Id);
        while (queue.Count > 0)
        {
            var currentId = queue.Dequeue();
            foreach (var child in folders.Where(f => f.ParentFolderId == currentId))
            {
                if (subtreeIds.Add(child.Id))
                {
                    queue.Enqueue(child.Id);
                }
            }
        }

        // Full entities, not the list projection - the export needs Content.
        var documents = await this.context.Documents
            .AsNoTracking()
            .Where(d => d.FolderId.HasValue
                && subtreeIds.Contains(d.FolderId.Value)
                && (includeExcluded || !d.ExcludedFromExport))
            .ToListAsync(cancellationToken);

        var markdown = BuildExportMarkdown(root, folders, documents);
        return this.Content(markdown, "text/markdown; charset=utf-8");
    }

    /// <summary>
    /// Builds the aggregated export markdown for a folder subtree per the
    /// format contract documented on <see cref="Export"/>.
    /// </summary>
    /// <param name="root">The folder being exported.</param>
    /// <param name="allFolders">Every folder (the subtree is re-walked recursively from here).</param>
    /// <param name="documents">The documents contained in the subtree.</param>
    /// <returns>The complete markdown text.</returns>
    private static string BuildExportMarkdown(Folder root, IReadOnlyList<Folder> allFolders, IReadOnlyList<PlantUmlDocument> documents)
    {
        var childFolders = allFolders
            .Where(f => f.ParentFolderId.HasValue)
            .ToLookup(f => f.ParentFolderId!.Value);
        var folderDocuments = documents
            .Where(d => d.FolderId.HasValue)
            .ToLookup(d => d.FolderId!.Value);

        var sections = new List<string>();
        AppendFolderSections(root, new HashSet<Guid>(), childFolders, folderDocuments, sections);
        if (sections.Count == 0)
        {
            sections.Add("_This folder contains no documents._");
        }

        var builder = new StringBuilder();
        builder.AppendJoin("\n\n", sections);
        builder.Append('\n');
        return builder.ToString();
    }

    /// <summary>
    /// Recursively appends one folder's "index" document (if any), its
    /// subfolder sections, and its remaining document sections. Folder and
    /// document names are never emitted - only document content.
    /// </summary>
    /// <param name="folder">The folder to append.</param>
    /// <param name="visited">Folders already emitted, guarding against parent cycles.</param>
    /// <param name="childFolders">All folders keyed by parent folder id.</param>
    /// <param name="folderDocuments">Subtree documents keyed by containing folder id.</param>
    /// <param name="sections">The output list of markdown sections.</param>
    private static void AppendFolderSections(
        Folder folder,
        HashSet<Guid> visited,
        ILookup<Guid, Folder> childFolders,
        ILookup<Guid, PlantUmlDocument> folderDocuments,
        List<string> sections)
    {
        if (!visited.Add(folder.Id))
        {
            return;
        }

        var documents = folderDocuments[folder.Id];

        // An "index" document is the folder's landing page, so it renders at the
        // very top - above the subfolder sections, not merely first among the
        // folder's own documents.
        foreach (var document in documents.Where(IsIndexDocument).OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase))
        {
            AppendDocumentSection(document, sections);
        }

        foreach (var child in childFolders[folder.Id].OrderBy(f => f.Name, StringComparer.OrdinalIgnoreCase))
        {
            AppendFolderSections(child, visited, childFolders, folderDocuments, sections);
        }

        foreach (var document in documents.Where(d => !IsIndexDocument(d)).OrderBy(d => d.Name, StringComparer.OrdinalIgnoreCase))
        {
            AppendDocumentSection(document, sections);
        }
    }

    /// <summary>
    /// Whether a document is a folder's "index" (landing) document, matched by
    /// name case-insensitively - the same comparison the rest of the export
    /// ordering uses.
    /// </summary>
    /// <param name="document">The document to test.</param>
    /// <returns>True if the document's name is "index" (any casing).</returns>
    private static bool IsIndexDocument(PlantUmlDocument document) =>
        string.Equals(document.Name, IndexDocumentName, StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// Appends one document's content (markdown inlined verbatim, plantuml
    /// wrapped in a fenced code block). The document's name is not emitted.
    /// </summary>
    /// <param name="document">The document to append.</param>
    /// <param name="sections">The output list of markdown sections.</param>
    private static void AppendDocumentSection(PlantUmlDocument document, List<string> sections)
    {
        var content = NormalizeContent(document.Content);
        sections.Add(document.Kind == DocumentKinds.Markdown
            ? content
            : $"```plantuml\n{content}\n```");
    }

    /// <summary>
    /// Normalizes document content for embedding: CRLF becomes LF and
    /// trailing newlines are trimmed (each section supplies its own blank-line
    /// separation).
    /// </summary>
    /// <param name="content">The raw stored document content.</param>
    /// <returns>The normalized content.</returns>
    private static string NormalizeContent(string content) =>
        content.Replace("\r\n", "\n").TrimEnd('\n');
}
