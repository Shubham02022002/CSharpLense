using CSharpLens.Domain.Models;

namespace CSharpLens.AI;

/// <summary>Explains an analyzed code model, so Roslyn stays the source of truth.</summary>
public interface ICodeExplanationService
{
    Task<CodeExplanation> ExplainAsync(
        CodeAnalysis analysis,
        string question,
        CancellationToken cancellationToken = default);

    Task<CodeExplanation> ExplainNodeAsync(
        CodeAnalysis analysis,
        Guid nodeId,
        CancellationToken cancellationToken = default);
}
