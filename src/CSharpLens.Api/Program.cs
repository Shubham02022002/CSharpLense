using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using CSharpLens.AI;
using CSharpLens.Analysis;
using CSharpLens.Api;
using CSharpLens.Voice;

const int MaxSourceLength = 200_000;
const int MaxQuestionLength = 2_000;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddOpenApi();

builder.Services.ConfigureHttpJsonOptions(options =>
{
    // Serialize enums by name. Positional enum numbering silently changes if the
    // domain enums are ever reordered, and the frontend reads these values.
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// The derived model is kept; the submitted source is not.
builder.Services.AddMemoryCache(options => options.SizeLimit = 512);

builder.Services.AddSingleton<ICSharpAnalyzer, RoslynCSharpAnalyzer>();
builder.Services.AddSingleton<IAnalysisStore, InMemoryAnalysisStore>();

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
    options.Limits.MaxRequestBodySize = 1_048_576;
});

var app = builder.Build();

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
    IAnalysisStore store,
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

    store.Save(analysis);

    return Results.Ok(analysis);
});

app.MapGet("/api/analyze/{id:guid}", (Guid id, IAnalysisStore store) =>
{
    var analysis = store.Get(id);

    return analysis is null
        ? Results.NotFound(new { error = "Analysis not found or expired." })
        : Results.Ok(analysis);
});

app.MapPost("/api/analyze/{id:guid}/questions", async (
    Guid id,
    QuestionRequest request,
    IAnalysisStore store,
    ICodeExplanationService explainer,
    ILoggerFactory loggerFactory,
    CancellationToken cancellationToken) =>
{
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

    var analysis = store.Get(id);

    if (analysis is null)
    {
        return Results.NotFound(new { error = "Analysis not found or expired." });
    }

    var logger = loggerFactory.CreateLogger("Explain");
    var stopwatch = System.Diagnostics.Stopwatch.StartNew();

    try
    {
        var explanation = await explainer.ExplainAsync(
            analysis,
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

app.MapPost("/api/analyze/{id:guid}/nodes/{nodeId:guid}/explain", async (
    Guid id,
    Guid nodeId,
    IAnalysisStore store,
    ICodeExplanationService explainer,
    ILoggerFactory loggerFactory,
    CancellationToken cancellationToken) =>
{
    var analysis = store.Get(id);

    if (analysis is null)
    {
        return Results.NotFound(new { error = "Analysis not found or expired." });
    }

    var logger = loggerFactory.CreateLogger("Explain");

    try
    {
        var explanation = await explainer.ExplainNodeAsync(analysis, nodeId, cancellationToken);

        logger.LogInformation(
            "Explained node {NodeId} via {Source}",
            nodeId,
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

app.MapPost("/api/analyze/{id:guid}/speak", async (
    Guid id,
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
