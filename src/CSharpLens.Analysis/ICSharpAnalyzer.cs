using CSharpLens.Domain.Models;

namespace CSharpLens.Analysis;

public interface ICSharpAnalyzer
{
    Task<CodeAnalysis> AnalyzeAsync(
        string sourceCode,
        CancellationToken cancellationToken = default);
}