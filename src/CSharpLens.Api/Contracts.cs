using CSharpLens.Domain.Models;

namespace CSharpLens.Api;

public record AnalyzeRequest(string SourceCode);

/// <summary>
/// Carries the analysis back rather than naming a stored one. The API keeps no
/// state, so nothing is lost when the host recycles the process; the analysis
/// has to travel with the question because node ids only mean anything
/// alongside the analysis that produced them.
/// </summary>
public record QuestionRequest(CodeAnalysis? Analysis, string Question);

/// <summary>See <see cref="QuestionRequest"/> for why the analysis is sent.</summary>
public record ExplainNodeRequest(CodeAnalysis? Analysis, Guid NodeId);

public record SpeakRequest(string Text);

/// <summary>Tells the frontend which server-side capabilities are available.</summary>
public record CapabilitiesResponse(bool AiConfigured, bool SpeechConfigured, string ExplanationSource);
