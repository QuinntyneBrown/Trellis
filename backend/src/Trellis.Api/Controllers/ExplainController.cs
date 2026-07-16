using Microsoft.AspNetCore.Mvc;
using Trellis.Api.Contracts;
using Trellis.Api.Explain;
using Trellis.Api.Models;

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

    /// <summary>
    /// Initializes a new instance of the <see cref="ExplainController"/> class.
    /// </summary>
    /// <param name="aggregator">The file aggregator.</param>
    /// <param name="promptBuilder">The prompt builder.</param>
    /// <param name="repositoryFetcher">The repository archive fetcher.</param>
    public ExplainController(IFileAggregator aggregator, IExplainPromptBuilder promptBuilder, IGitRepositoryFetcher repositoryFetcher)
    {
        this.aggregator = aggregator;
        this.promptBuilder = promptBuilder;
        this.repositoryFetcher = repositoryFetcher;
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

    private ObjectResult ExplainProblem(string title)
        => this.BadRequest(new ProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Title = title,
        });
}
