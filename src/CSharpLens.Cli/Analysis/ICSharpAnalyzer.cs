using CSharpLens.Cli.Domain;

namespace CSharpLens.Cli.Analysis;

public interface ICSharpAnalyzer
{
    Task<CodeAnalysis> AnalyzeAsync(
        string sourceCode,
        CancellationToken cancellationToken = default);
}