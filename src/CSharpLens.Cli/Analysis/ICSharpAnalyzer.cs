using CSharpLens.Domain.Models;

namespace CSharpLens.Cli.Analysis;

public interface ICSharpAnalyzer
{
    Task<CodeAnalysis> AnalyzeAsync(
        string sourceCode,
        CancellationToken cancellationToken = default);
}