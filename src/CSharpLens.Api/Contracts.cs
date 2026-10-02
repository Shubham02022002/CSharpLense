namespace CSharpLens.Api;

public record AnalyzeRequest(string SourceCode);

public record QuestionRequest(string Question);

public record SpeakRequest(string Text);

/// <summary>Tells the frontend which server-side capabilities are available.</summary>
public record CapabilitiesResponse(bool AiConfigured, bool SpeechConfigured, string ExplanationSource);
