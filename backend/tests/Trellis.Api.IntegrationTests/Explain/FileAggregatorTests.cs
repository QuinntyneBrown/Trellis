using Trellis.Api.Explain;

namespace Trellis.Api.IntegrationTests.Explain;

/// <summary>
/// Pins the aggregation contract: policy filtering, deterministic ordering,
/// GetFiles delimiters, language-tagged fences (```plantuml for .puml),
/// verbatim markdown/PlantUML bodies and fence-collision handling.
/// </summary>
public class FileAggregatorTests
{
    private readonly FileAggregator aggregator = new();

    [Fact]
    public void WrapsPlantUml_InPlantumlFence_Verbatim()
    {
        var result = this.aggregator.Aggregate(new[]
        {
            new SourceFile("diagrams/context.puml", "@startuml\n' a comment that must survive\nA -> B\n@enduml"),
        });

        Assert.Equal(1, result.FileCount);
        Assert.Contains("=== FILE: diagrams/context.puml ===\n```plantuml\n@startuml\n' a comment that must survive\nA -> B\n@enduml\n```\n=== END FILE: diagrams/context.puml ===", result.Content);
    }

    [Fact]
    public void IncludesMarkdown_Verbatim_WithLongerFenceWhenBodyContainsFences()
    {
        var result = this.aggregator.Aggregate(new[]
        {
            new SourceFile("README.md", "# Title\n\n```ts\nconst a = 1; // kept: markdown is verbatim\n```\n"),
        });

        Assert.Contains("````markdown\n# Title", result.Content);
        Assert.Contains("```\n````\n=== END FILE: README.md ===", result.Content);
        Assert.Contains("// kept: markdown is verbatim", result.Content);
    }

    [Fact]
    public void StripsComments_FromCodeFiles()
    {
        var result = this.aggregator.Aggregate(new[]
        {
            new SourceFile("src/a.ts", "// header comment\nconst a = 1;\n"),
        });

        Assert.DoesNotContain("header comment", result.Content);
        Assert.Contains("const a = 1;", result.Content);
    }

    [Fact]
    public void ExcludesDisallowedExtensions_AndExcludedFolders()
    {
        var result = this.aggregator.Aggregate(new[]
        {
            new SourceFile("src/app.ts", "const a = 1;"),
            new SourceFile("image.png", "binary"),
            new SourceFile("node_modules/lib/index.ts", "ignored"),
            new SourceFile("backend/bin/Debug/out.cs", "ignored"),
            new SourceFile(".git/config.yml", "ignored"),
        });

        Assert.Equal(1, result.FileCount);
        Assert.Contains("src/app.ts", result.Content);
        Assert.DoesNotContain("node_modules", result.Content);
        Assert.DoesNotContain("image.png", result.Content);
    }

    [Fact]
    public void SortsFiles_ByPathOrdinalIgnoreCase()
    {
        var result = this.aggregator.Aggregate(new[]
        {
            new SourceFile("z.ts", "const z = 1;"),
            new SourceFile("A.ts", "const a = 1;"),
            new SourceFile("m/b.ts", "const b = 1;"),
        });

        var indexOfA = result.Content.IndexOf("=== FILE: A.ts ===", StringComparison.Ordinal);
        var indexOfM = result.Content.IndexOf("=== FILE: m/b.ts ===", StringComparison.Ordinal);
        var indexOfZ = result.Content.IndexOf("=== FILE: z.ts ===", StringComparison.Ordinal);

        Assert.True(indexOfA >= 0 && indexOfA < indexOfM && indexOfM < indexOfZ);
    }

    [Fact]
    public void NormalizesBackslashAndDotSlashPaths()
    {
        var result = this.aggregator.Aggregate(new[]
        {
            new SourceFile(@".\src\app.ts", "const a = 1;"),
        });

        Assert.Contains("=== FILE: src/app.ts ===", result.Content);
    }

    [Fact]
    public void ReturnsEmptyResult_WhenNothingSurvivesTheFilter()
    {
        var result = this.aggregator.Aggregate(new[] { new SourceFile("a.exe", "x") });

        Assert.Equal(0, result.FileCount);
        Assert.Equal(string.Empty, result.Content);
    }
}
