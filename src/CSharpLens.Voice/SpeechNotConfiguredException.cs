namespace CSharpLens.Voice;

/// <summary>Raised when speech was requested but no provider is configured.</summary>
public class SpeechNotConfiguredException : Exception
{
    public SpeechNotConfiguredException(string message)
        : base(message)
    {
    }
}
