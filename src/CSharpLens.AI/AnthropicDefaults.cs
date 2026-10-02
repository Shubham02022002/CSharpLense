using Anthropic.Models.Messages;

namespace CSharpLens.AI;

public static class AnthropicDefaults
{
    public const string Model = "claude-opus-5";

    public const int MaxTokens = 16000;

    /// <summary>Reasoning effort; raise it for deeper architectural questions.</summary>
    public static readonly Effort DefaultEffort = Effort.Low;

    public const string ApiKeyVariable = "ANTHROPIC_API_KEY";

    /// <summary>Parses an effort name, or <c>null</c> if unrecognised.</summary>
    public static Effort? ParseEffort(string? value) => value?.ToLowerInvariant() switch
    {
        "low" => Effort.Low,
        "medium" => Effort.Medium,
        "high" => Effort.High,
        "max" => Effort.Max,
        _ => null
    };
}
