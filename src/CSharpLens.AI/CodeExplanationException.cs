namespace CSharpLens.AI;

/// <summary>Raised when an explanation cannot be produced.</summary>
public class CodeExplanationException : Exception
{
    public CodeExplanationException(string message, bool isTransient, Exception? inner = null)
        : base(message, inner)
    {
        IsTransient = isTransient;
    }

    /// <summary>True when retrying the same request could succeed (rate limit, provider outage).</summary>
    public bool IsTransient { get; }
}
