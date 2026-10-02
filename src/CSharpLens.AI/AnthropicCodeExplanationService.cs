using Anthropic;
using Anthropic.Exceptions;
using Anthropic.Models.Messages;
using CSharpLens.Domain.Models;
using Microsoft.Extensions.Logging;

namespace CSharpLens.AI;

/// <summary>Produces explanations with the Anthropic Messages API.</summary>
public class AnthropicCodeExplanationService : ICodeExplanationService
{
    public const string SourceName = "anthropic";

    private const string Instructions = """
        You are the explanation layer of CSharpLens, a tool that helps C# developers
        understand code they are looking at.

        The structural description you are given was extracted by the Roslyn compiler.
        It is authoritative. Never contradict it, and never invent types, members,
        relationships, or line numbers that are not listed there.

        You explain and teach. You do not decide what the code contains.

        - Be concrete: name the actual types and members from the description.
        - Keep it tight: at most three short paragraphs. No preamble, no restating
          the question, no summary of what you are about to say.
        - Write plain prose. Do not use markdown headings, bullet points, bold, or
          code fences.
        - If the description does not contain what is needed to answer, say so plainly
          instead of guessing.
        """;

    private readonly AnthropicClient _client;
    private readonly ILogger<AnthropicCodeExplanationService>? _logger;
    private readonly string _model;
    private readonly int _maxTokens;
    private readonly Effort _effort;

    public AnthropicCodeExplanationService(
        string apiKey,
        string model = AnthropicDefaults.Model,
        int maxTokens = AnthropicDefaults.MaxTokens,
        Effort? effort = null,
        ILogger<AnthropicCodeExplanationService>? logger = null)
    {
        _client = new AnthropicClient { ApiKey = apiKey };
        _logger = logger;
        _model = model;
        _maxTokens = maxTokens;
        _effort = effort ?? AnthropicDefaults.DefaultEffort;
    }

    public Task<CodeExplanation> ExplainAsync(
        CodeAnalysis analysis,
        string question,
        CancellationToken cancellationToken = default) =>
        Explain(analysis, question, focusNodeId: null, cancellationToken);

    public Task<CodeExplanation> ExplainNodeAsync(
        CodeAnalysis analysis,
        Guid nodeId,
        CancellationToken cancellationToken = default)
    {
        var type = analysis.Types.FirstOrDefault(t => t.Id == nodeId);

        var member = type is null
            ? analysis.Types.SelectMany(t => t.Members).FirstOrDefault(m => m.Id == nodeId)
            : null;

        var question = type is not null
            ? $"Explain the type {type.Name}: what it is, what it holds, and how it relates to the rest of the code."
            : member is not null
                ? $"Explain the {member.Kind.ToString().ToLowerInvariant()} {member.Name}: what it does and why it is declared this way."
                : "Explain the selected element.";

        return Explain(analysis, question, nodeId, cancellationToken);
    }

    private async Task<CodeExplanation> Explain(
        CodeAnalysis analysis,
        string question,
        Guid? focusNodeId,
        CancellationToken cancellationToken)
    {
        var context = CodeContextBuilder.Build(analysis, focusNodeId);

        var parameters = new MessageCreateParams
        {
            Model = _model,
            MaxTokens = _maxTokens,
            Thinking = new ThinkingConfigAdaptive(),
            OutputConfig = new OutputConfig { Effort = _effort },

            // Stable prefix first (instructions, then the code model) so the
            // cached span covers everything except the question itself.
            System = new List<TextBlockParam>
            {
                new() { Text = Instructions },
                new()
                {
                    Text = "Code model:\n\n" + context,
                    CacheControl = new CacheControlEphemeral()
                }
            },

            Messages =
            [
                new() { Role = Role.User, Content = question }
            ]
        };

        Message response;

        try
        {
            response = await _client.Messages.Create(parameters, cancellationToken: cancellationToken);
        }
        catch (AnthropicRateLimitException exception)
        {
            _logger?.LogDebug(exception, "Anthropic rate limited the request");

            throw new CodeExplanationException(
                "The explanation service is rate limited. Try again shortly.",
                isTransient: true,
                exception);
        }
        catch (Anthropic5xxException exception)
        {
            _logger?.LogDebug(exception, "Anthropic returned a server error");

            throw new CodeExplanationException(
                "The explanation service is unavailable right now.",
                isTransient: true,
                exception);
        }
        catch (AnthropicApiException exception)
        {
            _logger?.LogDebug(exception, "Anthropic rejected the request");

            throw new CodeExplanationException(
                "The explanation service rejected the request.",
                isTransient: false,
                exception);
        }

        if (response.StopReason == "refusal")
        {
            throw new CodeExplanationException(
                "The explanation service declined to answer this question.",
                isTransient: false);
        }

        var answer = string.Concat(
            response.Content
                .Select(block => block.Value)
                .OfType<TextBlock>()
                .Select(text => text.Text)).Trim();

        if (string.IsNullOrWhiteSpace(answer))
        {
            throw new CodeExplanationException(
                "The explanation service returned an empty response.",
                isTransient: true);
        }

        // Focus nodes and concepts come from the model, never from the answer.
        var focusNodeIds = FocusNodeResolver.ResolveFromText(analysis, answer);

        // The asked-about element leads, whether or not the answer named it.
        if (focusNodeId is { } subject)
        {
            focusNodeIds.Remove(subject);
            focusNodeIds.Insert(0, subject);
        }

        return new CodeExplanation
        {
            Answer = answer,
            FocusNodeIds = focusNodeIds,
            Concepts = ConceptInference.Infer(analysis, focusNodeIds),
            Source = SourceName
        };
    }

}
