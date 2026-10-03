using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using CSharpLens.AI;
using CSharpLens.Analysis;
using CSharpLens.Api;
using CSharpLens.Voice;
using Microsoft.AspNetCore.HttpOverrides;

const int MaxSourceLength = 200_000;
const int MaxQuestionLength = 2_000;

// The analysis travels with the question, so it is bounded here rather than by
// the analyzer's source limit.
const long MaxRequestBodyBytes = 4_194_304;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.AllowAnyHeader().AllowAnyMethod();

        if (builder.Environment.IsDevelopment())
        {
            // Vite moves to the next free port when 5173 is taken, so any local
            // port is accepted while developing. Production stays pinned.
            policy.SetIsOriginAllowed(origin =>
                Uri.TryCreate(origin, UriKind.Absolute, out var uri)
                && uri.Host is "localhost" or "127.0.0.1");
        }
        else
        {
            // Read from configuration so the deployed frontend's host is not
            // baked into the image. Empty means no browser origin is allowed.
            var origins = (builder.Configuration["CORS_ORIGINS"] ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            policy.WithOrigins(origins);
        }
    });
});

builder.Services.AddOpenApi();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    // Serialize enums by name. Positional enum numbering silently changes if the
    // domain enums are ever reordered, and the frontend reads these values.
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

builder.Services.AddSingleton<ICSharpAnalyzer, RoslynCSharpAnalyzer>();

// Explanations fall back to a Roslyn-only summary when no provider key is set.
var anthropicApiKey = GetSetting(builder.Configuration, AnthropicDefaults.ApiKeyVariable);

var aiConfigured = !string.IsNullOrWhiteSpace(anthropicApiKey);

if (aiConfigured)
{
    var model = GetSetting(builder.Configuration, "ANTHROPIC_MODEL") ?? AnthropicDefaults.Model;
    var effort = AnthropicDefaults.ParseEffort(GetSetting(builder.Configuration, "ANTHROPIC_EFFORT"));

    builder.Services.AddSingleton<ICodeExplanationService>(services =>
        new AnthropicCodeExplanationService(
            anthropicApiKey!,
            model: model,
            effort: effort,
            logger: services.GetRequiredService<ILogger<AnthropicCodeExplanationService>>()));
}
else
{
    builder.Services.AddSingleton<ICodeExplanationService, HeuristicCodeExplanationService>();
}

var elevenLabsApiKey = GetSetting(builder.Configuration, ElevenLabsOptions.ApiKeyVariable);

var speechConfigured = !string.IsNullOrWhiteSpace(elevenLabsApiKey);

if (speechConfigured)
{
    builder.Services.AddSingleton(new ElevenLabsOptions
    {
        ApiKey = elevenLabsApiKey!,
        VoiceId = GetSetting(builder.Configuration, "ELEVENLABS_VOICE_ID")
                  ?? ElevenLabsOptions.DefaultVoiceId,
        ModelId = GetSetting(builder.Configuration, "ELEVENLABS_MODEL_ID")
                  ?? ElevenLabsOptions.DefaultModelId
    });

    builder.Services.AddHttpClient<ISpeechService, ElevenLabsSpeechService>();
}
else
{
    // The frontend narrates with the browser's speech synthesis instead.
    builder.Services.AddSingleton<ISpeechService, NullSpeechService>();
}

// AI calls cost money and hit a shared provider, so they are rate limited.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("ai", context => RateLimitPartition.GetFixedWindowLimiter(
        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        factory: _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 20,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        }));
});

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = MaxRequestBodyBytes;
});

var app = builder.Build();

// A hosted deployment terminates TLS and forwards over plain HTTP, so the
// original scheme and client address only survive if these headers are read.
// Without it the redirect below would loop, and every caller would share the
// proxy's address in the rate limiter's partition key.
var forwardedHeaders = new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
};

// The proxy's address is not known ahead of time, and the container is only
// reachable through it, so the default loopback-only trust list is cleared.
forwardedHeaders.KnownNetworks.Clear();
forwardedHeaders.KnownProxies.Clear();

app.UseForwardedHeaders(forwardedHeaders);

app.UseCors("Frontend");
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapGet("/api/capabilities", () => Results.Ok(new CapabilitiesResponse(
    AiConfigured: aiConfigured,
    SpeechConfigured: speechConfigured,
    ExplanationSource: aiConfigured
        ? AnthropicCodeExplanationService.SourceName
        : HeuristicCodeExplanationService.SourceName)));

app.MapPost("/api/analyze", async (
    AnalyzeRequest request,
    ICSharpAnalyzer analyzer,
    ILoggerFactory loggerFactory,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.SourceCode))
    {
        return Results.BadRequest(new { error = "Source code cannot be empty." });
    }

    if (request.SourceCode.Length > MaxSourceLength)
    {
        return Results.BadRequest(new
        {
            error = $"Source code exceeds the {MaxSourceLength:N0} character limit."
        });
    }

    var logger = loggerFactory.CreateLogger("Analyze");
    var stopwatch = System.Diagnostics.Stopwatch.StartNew();

    var analysis = await analyzer.AnalyzeAsync(request.SourceCode, cancellationToken);

    stopwatch.Stop();

    // Counts and timings only — never the source itself.
    logger.LogInformation(
        "Analyzed {Length} characters in {DurationMs}ms: {TypeCount} types, {RelationshipCount} relationships, {DiagnosticCount} diagnostics",
        request.SourceCode.Length,
        stopwatch.ElapsedMilliseconds,
        analysis.Types.Count,
        analysis.Relationships.Count,
        analysis.Diagnostics.Count);

    return Results.Ok(analysis);
});

app.MapPost("/api/questions", async (
    QuestionRequest request,
    ICodeExplanationService explainer,
    ILoggerFactory loggerFactory,
    CancellationToken cancellationToken) =>
{
    if (request.Analysis is null)
    {
        return Results.BadRequest(new { error = "An analysis is required." });
    }

    if (string.IsNullOrWhiteSpace(request.Question))
    {
        return Results.BadRequest(new { error = "Question cannot be empty." });
    }

    if (request.Question.Length > MaxQuestionLength)
    {
        return Results.BadRequest(new
        {
            error = $"Question exceeds the {MaxQuestionLength:N0} character limit."
        });
    }

    var logger = loggerFactory.CreateLogger("Explain");
    var stopwatch = System.Diagnostics.Stopwatch.StartNew();

    try
    {
        var explanation = await explainer.ExplainAsync(
            request.Analysis,
            request.Question,
            cancellationToken);

        stopwatch.Stop();

        logger.LogInformation(
            "Answered question in {DurationMs}ms via {Source} ({FocusCount} focus nodes)",
            stopwatch.ElapsedMilliseconds,
            explanation.Source,
            explanation.FocusNodeIds.Count);

        return Results.Ok(explanation);
    }
    catch (CodeExplanationException exception)
    {
        logger.LogWarning("Explanation failed: {Reason}", exception.Message);

        return exception.IsTransient
            ? Results.Json(new { error = exception.Message }, statusCode: 503)
            : Results.Json(new { error = exception.Message }, statusCode: 502);
    }
}).RequireRateLimiting("ai");

app.MapPost("/api/explain", async (
    ExplainNodeRequest request,
    ICodeExplanationService explainer,
    ILoggerFactory loggerFactory,
    CancellationToken cancellationToken) =>
{
    if (request.Analysis is null)
    {
        return Results.BadRequest(new { error = "An analysis is required." });
    }

    var logger = loggerFactory.CreateLogger("Explain");

    try
    {
        var explanation = await explainer.ExplainNodeAsync(
            request.Analysis,
            request.NodeId,
            cancellationToken);

        logger.LogInformation(
            "Explained node {NodeId} via {Source}",
            request.NodeId,
            explanation.Source);

        return Results.Ok(explanation);
    }
    catch (CodeExplanationException exception)
    {
        logger.LogWarning("Node explanation failed: {Reason}", exception.Message);

        return exception.IsTransient
            ? Results.Json(new { error = exception.Message }, statusCode: 503)
            : Results.Json(new { error = exception.Message }, statusCode: 502);
    }
}).RequireRateLimiting("ai");

app.MapPost("/api/speak", async (
    SpeakRequest request,
    ISpeechService speech,
    ILoggerFactory loggerFactory,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Text))
    {
        return Results.BadRequest(new { error = "Text cannot be empty." });
    }

    var logger = loggerFactory.CreateLogger("Speech");

    try
    {
        var audio = await speech.GenerateSpeechAsync(request.Text, cancellationToken);

        logger.LogInformation("Synthesized {Length} characters", request.Text.Length);

        return Results.File(audio, "audio/mpeg");
    }
    catch (SpeechNotConfiguredException exception)
    {
        // The frontend falls back to browser narration on 503.
        logger.LogInformation("Speech unavailable: {Reason}", exception.Message);

        return Results.Json(new { error = exception.Message }, statusCode: 503);
    }
}).RequireRateLimiting("ai");

app.Run();

// Reads from configuration, which layers environment variables over appsettings,
// so keys can also be supplied with `dotnet user-secrets` during development.
static string? GetSetting(IConfiguration configuration, string key)
{
    var value = configuration[key];
    return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
