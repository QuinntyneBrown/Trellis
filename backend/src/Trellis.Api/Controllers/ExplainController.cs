using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Trellis.Api.Contracts;
using Trellis.Api.Domain;
using Trellis.Api.Explain;
using Trellis.Api.Models;
using Trellis.Api.Persistence;

namespace Trellis.Api.Controllers;

/// <summary>
/// Builds "Explain This" prompts: a GetFiles-style aggregation of a selection
/// of source files wrapped in explain-this instructions for an LLM chat. The
/// selection arrives either as client-read file contents (local file/folder
/// pickers) or as a GitHub/GitLab URL fetched server-side.
/// </summary>
[ApiController]
[Route("api/explain")]
public class ExplainController : ControllerBase
{
    private const string AttachmentFileName = "explain-this-files.md";

    private readonly IFileAggregator aggregator;
    private readonly IExplainPromptBuilder promptBuilder;
    private readonly IGitRepositoryFetcher repositoryFetcher;
    private readonly ApplicationDbContext context;

    /// <summary>
    /// Initializes a new instance of the <see cref="ExplainController"/> class.
    /// </summary>
    /// <param name="aggregator">The file aggregator.</param>
    /// <param name="promptBuilder">The prompt builder.</param>
    /// <param name="repositoryFetcher">The repository archive fetcher.</param>
    /// <param name="context">The application database context (for the saved-folder endpoint).</param>
    public ExplainController(IFileAggregator aggregator, IExplainPromptBuilder promptBuilder, IGitRepositoryFetcher repositoryFetcher, ApplicationDbContext context)
    {
        this.aggregator = aggregator;
        this.promptBuilder = promptBuilder;
        this.repositoryFetcher = repositoryFetcher;
        this.context = context;
    }

    /// <summary>
    /// Builds the prompt and attachment from files the client read off the local file system.
    /// </summary>
    /// <param name="request">The files to aggregate.</param>
    /// <returns>The prompt.</returns>
    [HttpPost("aggregate")]
    public ActionResult<ExplainPromptDto> Aggregate(ExplainAggregateRequest request)
    {
        var files = request.Files.Select(f => new SourceFile(f.Path, f.Content)).ToList();
        return this.BuildPromptResult(files);
    }

    /// <summary>
    /// Builds the prompt and attachment from a GitHub/GitLab repository, folder or file URL.
    /// </summary>
    /// <param name="request">The URL to fetch and aggregate.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The prompt.</returns>
    [HttpPost("aggregate-url")]
    public async Task<ActionResult<ExplainPromptDto>> AggregateUrl(ExplainAggregateUrlRequest request, CancellationToken cancellationToken)
    {
        if (!GitRepositoryUrlParser.TryParse(request.Url, out var selection, out var error))
        {
            return this.ExplainProblem(error!);
        }

        try
        {
            var files = await this.repositoryFetcher.FetchAsync(selection!, cancellationToken);
            return this.BuildPromptResult(files);
        }
        catch (ExplainSourceException exception)
        {
            return this.ExplainProblem(exception.Message);
        }
    }

    /// <summary>
    /// Builds the prompt and attachment from every document saved in a folder
    /// and all of its descendant folders. PlantUML documents map to
    /// <c>.puml</c> source files and markdown documents to <c>.md</c>, so the
    /// aggregation flows through the same pipeline (and yields the same prompt
    /// and attachment shape) as a local-folder or repository selection. Every
    /// document is included regardless of its export-exclusion flag: that flag
    /// governs the separate markdown folder export, not "Explain This".
    /// </summary>
    /// <param name="id">The identifier of the folder to explain.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The prompt, 404 if the folder does not exist, or 400 if it contains no documents.</returns>
    [HttpGet("folder/{id:guid}")]
    public async Task<ActionResult<ExplainPromptDto>> AggregateFolder(Guid id, CancellationToken cancellationToken)
    {
        var folders = await this.context.Folders
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var root = folders.FirstOrDefault(f => f.Id == id);
        if (root is null)
        {
            return this.NotFound();
        }

        // In-memory BFS over the flat folder list, with a visited set so a
        // corrupt parent cycle cannot hang the walk -- the same subtree walk
        // FoldersController.Export performs.
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

        // Full entities, not the list projection -- the aggregation needs Content.
        var documents = await this.context.Documents
            .AsNoTracking()
            .Where(d => d.FolderId.HasValue && subtreeIds.Contains(d.FolderId.Value))
            .ToListAsync(cancellationToken);

        if (documents.Count == 0)
        {
            return this.ExplainProblem("This folder and its subfolders contain no documents to explain.");
        }

        return this.BuildPromptResult(MapDocumentsToSourceFiles(root, folders, documents));
    }

    /// <summary>
    /// Shared tail of both endpoints: aggregate, reject empty results, wrap
    /// in the prompt. <see cref="ExplainSourceException"/> (the oversized-
    /// selection guard) is translated to the same 400 problem shape as URL
    /// failures rather than leaking to the generic 500 handler.
    /// </summary>
    private ActionResult<ExplainPromptDto> BuildPromptResult(IReadOnlyList<SourceFile> files)
    {
        AggregationResult aggregation;
        try
        {
            aggregation = this.aggregator.Aggregate(files);
        }
        catch (ExplainSourceException exception)
        {
            return this.ExplainProblem(exception.Message);
        }

        if (aggregation.FileCount == 0)
        {
            return this.ExplainProblem(
                "No supported files were found in the selection. Supported types: .ts, .html, .scss, .css, .cs, .csproj, .sln, .json, .yaml, .yml, .md, .puml.");
        }

        return this.Ok(new ExplainPromptDto
        {
            Prompt = this.promptBuilder.Build(aggregation, AttachmentFileName),
            FileCount = aggregation.FileCount,
            AttachmentFileName = AttachmentFileName,
            AttachmentContent = aggregation.Content,
        });
    }

    /// <summary>
    /// Maps saved folder documents to <see cref="SourceFile"/>s with paths
    /// relative to the explained folder (mirroring how a local-folder
    /// selection is read): the chain of subfolder names beneath the root,
    /// followed by the document name plus a kind-derived extension
    /// (<c>.md</c> for markdown, <c>.puml</c> for PlantUML).
    /// </summary>
    /// <param name="root">The folder being explained (its own name is not part of the relative paths).</param>
    /// <param name="allFolders">Every folder, used to resolve each document's ancestor chain.</param>
    /// <param name="documents">The documents contained in the subtree.</param>
    /// <returns>The mapped source files.</returns>
    private static IReadOnlyList<SourceFile> MapDocumentsToSourceFiles(
        Folder root,
        IReadOnlyList<Folder> allFolders,
        IReadOnlyList<PlantUmlDocument> documents)
    {
        var foldersById = allFolders.ToDictionary(f => f.Id);
        return documents
            .Select(document => new SourceFile(BuildRelativePath(root, foldersById, document), document.Content))
            .ToList();
    }

    /// <summary>
    /// Builds one document's folder-relative path: its ancestor folder names
    /// from just beneath the root down to its own folder, then the document
    /// name with a kind-derived extension. A visited set guards against a
    /// corrupt parent cycle, and slashes in names are replaced so a stray
    /// separator cannot invent extra path segments (the aggregator treats
    /// path segments as folders).
    /// </summary>
    /// <param name="root">The folder being explained.</param>
    /// <param name="foldersById">Every folder keyed by id.</param>
    /// <param name="document">The document whose path is built.</param>
    /// <returns>The forward-slash relative path.</returns>
    private static string BuildRelativePath(
        Folder root,
        IReadOnlyDictionary<Guid, Folder> foldersById,
        PlantUmlDocument document)
    {
        var segments = new List<string>();
        var visited = new HashSet<Guid>();
        var folderId = document.FolderId;
        while (folderId.HasValue
            && folderId.Value != root.Id
            && visited.Add(folderId.Value)
            && foldersById.TryGetValue(folderId.Value, out var folder))
        {
            segments.Add(Sanitize(folder.Name));
            folderId = folder.ParentFolderId;
        }

        segments.Reverse();
        var extension = document.Kind == DocumentKinds.Markdown ? ".md" : ".puml";
        segments.Add(Sanitize(document.Name) + extension);
        return string.Join('/', segments);
    }

    /// <summary>Replaces path separators in a folder/document name so it stays a single path segment.</summary>
    /// <param name="name">The raw name.</param>
    /// <returns>The name with slashes replaced by underscores.</returns>
    private static string Sanitize(string name) => name.Replace('/', '_').Replace('\\', '_');

    private ObjectResult ExplainProblem(string title)
        => this.BadRequest(new ProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Title = title,
        });
}
