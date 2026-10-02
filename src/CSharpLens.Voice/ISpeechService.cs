namespace CSharpLens.Voice;

/// <summary>Turns an explanation into audio, server-side, so keys stay off the client.</summary>
public interface ISpeechService
{
    /// <summary>Returns an audio stream for <paramref name="text"/>.</summary>
    Task<Stream> GenerateSpeechAsync(
        string text,
        CancellationToken cancellationToken = default);
}
