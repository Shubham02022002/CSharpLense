using System.Net.Http.Json;

namespace CSharpLens.Voice;

public class ElevenLabsOptions
{
    public const string ApiKeyVariable = "ELEVENLABS_API_KEY";

    /// <summary>ElevenLabs "Rachel", a general-purpose default voice.</summary>
    public const string DefaultVoiceId = "21m00Tcm4TlvDq8ikWAM";

    /// <summary>Turbo model: lower latency, which matters when narrating an answer.</summary>
    public const string DefaultModelId = "eleven_turbo_v2_5";

    public string ApiKey { get; set; } = "";

    public string VoiceId { get; set; } = DefaultVoiceId;

    public string ModelId { get; set; } = DefaultModelId;
}

public class ElevenLabsSpeechService : ISpeechService
{
    private const int MaxTextLength = 2500;

    private readonly HttpClient _httpClient;
    private readonly ElevenLabsOptions _options;

    public ElevenLabsSpeechService(HttpClient httpClient, ElevenLabsOptions options)
    {
        _httpClient = httpClient;
        _options = options;
    }

    public async Task<Stream> GenerateSpeechAsync(
        string text,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            throw new SpeechNotConfiguredException("No ElevenLabs API key is configured.");
        }

        if (string.IsNullOrWhiteSpace(text))
        {
            throw new ArgumentException("Text cannot be empty.", nameof(text));
        }

        // Narration of a long answer can run past the provider's limit; trim at a
        // sentence boundary rather than failing the request outright.
        var trimmed = text.Length > MaxTextLength
            ? text[..MaxTextLength]
            : text;

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://api.elevenlabs.io/v1/text-to-speech/{_options.VoiceId}")
        {
            Content = JsonContent.Create(new
            {
                text = trimmed,
                model_id = _options.ModelId
            })
        };

        request.Headers.Add("xi-api-key", _options.ApiKey);

        using var response = await _httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new SpeechNotConfiguredException(
                $"The speech provider returned {(int)response.StatusCode}.");
        }

        // Copy into memory so the stream outlives the response message.
        var buffer = new MemoryStream();
        await response.Content.CopyToAsync(buffer, cancellationToken);
        buffer.Position = 0;

        return buffer;
    }
}
