namespace CSharpLens.Voice;

/// <summary>Default when no speech provider is configured.</summary>
public class NullSpeechService : ISpeechService
{
    public Task<Stream> GenerateSpeechAsync(
        string text,
        CancellationToken cancellationToken = default) =>
        throw new SpeechNotConfiguredException(
            "No speech provider is configured. Set ELEVENLABS_API_KEY to enable server-side narration.");
}
