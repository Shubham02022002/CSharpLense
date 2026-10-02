using System.Text;
using CSharpLens.Domain.Models;

namespace CSharpLens.AI;

/// <summary>Explains a code model from its structure alone, with no language model.</summary>
public class HeuristicCodeExplanationService : ICodeExplanationService
{
    public const string SourceName = "heuristic";

    public Task<CodeExplanation> ExplainAsync(
        CodeAnalysis analysis,
        string question,
        CancellationToken cancellationToken = default)
    {
        var mentioned = analysis.Types
            .Where(t => question.Contains(t.Name, StringComparison.OrdinalIgnoreCase))
            .ToList();

        var explanation = mentioned.Count > 0
            ? ExplainTypes(analysis, mentioned, question)
            : ExplainOverview(analysis, question);

        return Task.FromResult(explanation);
    }

    public Task<CodeExplanation> ExplainNodeAsync(
        CodeAnalysis analysis,
        Guid nodeId,
        CancellationToken cancellationToken = default)
    {
        var type = analysis.Types.FirstOrDefault(t => t.Id == nodeId);

        if (type is not null)
        {
            return Task.FromResult(ExplainTypes(analysis, [type], null));
        }

        var member = analysis.Types
            .SelectMany(t => t.Members)
            .FirstOrDefault(m => m.Id == nodeId);

        if (member is not null)
        {
            var owner = analysis.Types.First(t => t.Members.Contains(member));

            return Task.FromResult(ExplainMember(owner, member));
        }

        return Task.FromResult(new CodeExplanation
        {
            Answer = "That element is no longer part of the current analysis.",
            Source = SourceName
        });
    }

    private static CodeExplanation ExplainOverview(CodeAnalysis analysis, string question)
    {
        var builder = new StringBuilder();

        builder.Append(
            $"This file declares {analysis.Types.Count} type(s): ");

        builder.Append(string.Join(
            ", ",
            analysis.Types.Select(t => $"{t.Name} ({t.Kind})")));

        builder.Append('.');

        if (analysis.Diagnostics.Count > 0)
        {
            builder.Append(
                $" The compiler reports {analysis.Diagnostics.Count} diagnostic(s), " +
                "listed under Diagnostics.");
        }

        builder.Append(
            " Ask about a specific type by name, or select a node in the graph, " +
            "for a structural breakdown.");

        if (!string.IsNullOrWhiteSpace(question))
        {
            builder.Append(
                " (No AI provider is configured, so this answer comes from the " +
                "Roslyn model only.)");
        }

        return new CodeExplanation
        {
            Answer = builder.ToString(),
            FocusNodeIds = analysis.Types.Select(t => t.Id).ToList(),
            Source = SourceName
        };
    }

    private static CodeExplanation ExplainTypes(
        CodeAnalysis analysis,
        List<CodeType> types,
        string? question)
    {
        var builder = new StringBuilder();
        var concepts = new List<string>();
        var focus = new List<Guid>();

        var interfaceNames = analysis.Types
            .Where(t => t.Kind == CodeTypeKind.Interface)
            .Select(t => t.Name)
            .ToList();

        foreach (var type in types)
        {
            var relationships = analysis.Relationships
                .Where(r => r.SourceId == type.Id || r.TargetId == type.Id)
                .ToList();

            builder.AppendLine($"{type.Name} is a {DescribeKind(type)}.");

            if (type.BaseTypes.Count > 0)
            {
                builder.AppendLine(
                    $"It derives from or implements {string.Join(", ", type.BaseTypes)}.");
            }

            var publicMembers = type.Members
                .Where(m => m.Accessibility == "public")
                .ToList();

            if (type.Members.Count > 0)
            {
                builder.AppendLine(
                    $"It exposes {type.Members.Count} member(s)" +
                    (publicMembers.Count != type.Members.Count
                        ? $", {publicMembers.Count} of them public."
                        : "."));
            }

            var assignedFromConstructor = type.Members.Any(
                m => m.Kind == CodeMemberKind.Constructor && m.Parameters.Count > 0);

            if (assignedFromConstructor)
            {
                builder.AppendLine(
                    "It receives collaborators through its constructor, the usual " +
                    "shape for dependency injection.");
            }

            var dependsOnInterfaces = type.Members
                .Where(m => m.Kind is CodeMemberKind.Field or CodeMemberKind.Property)
                .Where(m => interfaceNames.Any(name => ConceptInference.MentionsType(m.ReturnType, name)))
                .ToList();

            if (dependsOnInterfaces.Count > 0)
            {
                builder.AppendLine(
                    "It depends on abstractions rather than concrete types, which " +
                    "keeps it replaceable and testable.");
            }

            var inheritors = relationships
                .Where(r => r.TargetId == type.Id && r.Type != RelationshipType.Dependency)
                .Select(r => analysis.Types.FirstOrDefault(t => t.Id == r.SourceId)?.Name)
                .Where(n => n is not null)
                .ToList();

            if (inheritors.Count > 0)
            {
                builder.AppendLine(
                    $"It is referenced by {string.Join(", ", inheritors)}.");
            }

            var dependencies = relationships
                .Where(r => r.SourceId == type.Id && r.Type == RelationshipType.Dependency)
                .Select(r => analysis.Types.FirstOrDefault(t => t.Id == r.TargetId)?.Name)
                .Where(n => n is not null)
                .ToList();

            if (dependencies.Count > 0)
            {
                builder.AppendLine(
                    $"It depends on {string.Join(", ", dependencies)}.");
            }

            focus.Add(type.Id);
            focus.AddRange(type.Members.Select(m => m.Id));

            builder.AppendLine();
        }

        concepts.AddRange(ConceptInference.Infer(analysis, focus));

        if (question is not null)
        {
            builder.AppendLine(
                "(No AI provider is configured, so this is a structural summary " +
                "built from the Roslyn model.)");
        }

        return new CodeExplanation
        {
            Answer = builder.ToString().TrimEnd(),
            FocusNodeIds = focus,
            Concepts = concepts.Distinct().ToList(),
            Source = SourceName
        };
    }

    private static CodeExplanation ExplainMember(CodeType owner, CodeMember member)
    {
        var builder = new StringBuilder();

        builder.AppendLine(
            $"{member.Name} is a {(string.IsNullOrEmpty(member.Accessibility) ? "" : member.Accessibility + " ")}{member.Kind.ToString().ToLowerInvariant()} " +
            $"declared on line {member.Location.StartLine} of {owner.Name}.");

        if (member.Kind == CodeMemberKind.Method)
        {
            builder.AppendLine(
                member.Parameters.Count == 0
                    ? $"It takes no parameters and returns {member.ReturnType}."
                    : $"It takes {member.Parameters.Count} parameter(s) " +
                      $"({string.Join(", ", member.Parameters)}) and returns {member.ReturnType}.");
        }
        else if (!string.IsNullOrEmpty(member.ReturnType))
        {
            builder.AppendLine($"Its type is {member.ReturnType}.");
        }

        if (member.Accessibility == "private")
        {
            builder.AppendLine(
                "It is private, so it is an implementation detail that only " +
                $"{owner.Name} itself can use.");
        }

        return new CodeExplanation
        {
            Answer = builder.ToString().TrimEnd(),
            FocusNodeIds = [member.Id, owner.Id],
            Concepts = member.Kind == CodeMemberKind.Property && member.Accessibility == "private"
                ? ["Encapsulation"]
                : [],
            Source = SourceName
        };
    }

    private static string DescribeKind(CodeType type)
    {
        var kind = type.Kind.ToString().ToLowerInvariant();

        if (type.Kind == CodeTypeKind.Interface)
        {
            return $"{kind} (a contract that other types implement)";
        }

        if (type.IsAbstract)
        {
            return $"abstract {kind} (it cannot be instantiated directly)";
        }

        if (type.IsStatic)
        {
            return $"static {kind}";
        }

        return kind;
    }
}
