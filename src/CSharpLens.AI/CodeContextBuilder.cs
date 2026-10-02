using System.Text;
using CSharpLens.Domain.Models;

namespace CSharpLens.AI;

/// <summary>Renders a <see cref="CodeAnalysis"/> as a compact structured description.</summary>
public static class CodeContextBuilder
{
    public static string Build(CodeAnalysis analysis, Guid? focusNodeId = null)
    {
        var builder = new StringBuilder();

        builder.AppendLine($"File contains {analysis.Types.Count} type(s) and " +
                           $"{analysis.Relationships.Count} relationship(s).");

        var focusType = focusNodeId is null
            ? null
            : analysis.Types.FirstOrDefault(t => t.Id == focusNodeId);

        var focusMember = focusNodeId is null
            ? null
            : analysis.Types
                .SelectMany(t => t.Members)
                .FirstOrDefault(m => m.Id == focusNodeId);

        if (focusType is not null)
        {
            builder.AppendLine();
            builder.AppendLine($"The developer has selected the type '{focusType.Name}'.");
        }
        else if (focusMember is not null)
        {
            var owner = analysis.Types.First(t => t.Members.Contains(focusMember));

            builder.AppendLine();
            builder.AppendLine(
                $"The developer has selected member '{focusMember.Name}' " +
                $"of type '{owner.Name}'.");
        }

        builder.AppendLine();

        foreach (var type in analysis.Types)
        {
            AppendType(builder, analysis, type);
        }

        AppendDiagnostics(builder, analysis);

        return builder.ToString();
    }

    private static void AppendType(
        StringBuilder builder,
        CodeAnalysis analysis,
        CodeType type)
    {
        var modifiers = Describe(type.Accessibility, type.IsStatic, type.IsAbstract);

        var name = string.IsNullOrEmpty(type.Namespace)
            ? type.Name
            : $"{type.Namespace}.{type.Name}";

        builder.AppendLine($"Type: {name}");
        builder.AppendLine($"  Kind: {type.Kind}{modifiers}");
        builder.AppendLine($"  Lines: {type.Location.StartLine}-{type.Location.EndLine}");

        if (type.BaseTypes.Count > 0)
        {
            builder.AppendLine($"  Inherits/implements: {string.Join(", ", type.BaseTypes)}");
        }

        if (type.Members.Count > 0)
        {
            builder.AppendLine("  Members:");

            foreach (var member in type.Members)
            {
                builder.AppendLine($"    - {DescribeMember(member)}");
            }
        }

        var outgoing = analysis.Relationships
            .Where(r => r.SourceId == type.Id)
            .Select(r => $"{r.Type} -> {NameOf(analysis, r.TargetId)}")
            .ToList();

        if (outgoing.Count > 0)
        {
            builder.AppendLine($"  Outgoing relationships: {string.Join("; ", outgoing)}");
        }

        var incoming = analysis.Relationships
            .Where(r => r.TargetId == type.Id)
            .Select(r => $"{NameOf(analysis, r.SourceId)} -> {r.Type}")
            .ToList();

        if (incoming.Count > 0)
        {
            builder.AppendLine($"  Incoming relationships: {string.Join("; ", incoming)}");
        }

        builder.AppendLine();
    }

    private static string DescribeMember(CodeMember member)
    {
        var modifiers = Describe(member.Accessibility, member.IsStatic, isAbstract: false);

        var name = member.Kind == CodeMemberKind.Constructor
            ? $"{member.Name}({string.Join(", ", member.Parameters)})"
            : member.Kind is CodeMemberKind.Method
                ? $"{member.Name}({string.Join(", ", member.Parameters)}) : {member.ReturnType}"
                : $"{member.Name} : {member.ReturnType}";

        return $"{member.Name} is a {member.Kind} ({modifiers.Trim()}) "
               + $"declared as {name} on line {member.Location.StartLine}";
    }

    private static void AppendDiagnostics(StringBuilder builder, CodeAnalysis analysis)
    {
        if (analysis.Diagnostics.Count == 0)
        {
            return;
        }

        builder.AppendLine($"Compiler diagnostics ({analysis.Diagnostics.Count}):");

        foreach (var diagnostic in analysis.Diagnostics)
        {
            builder.AppendLine(
                $"  - {diagnostic.Code} [{diagnostic.Severity}] "
                + $"line {diagnostic.Location.StartLine}: {diagnostic.Message}");
        }
    }

    private static string NameOf(CodeAnalysis analysis, Guid id) =>
        analysis.Types.FirstOrDefault(t => t.Id == id)?.Name ?? "unknown";

    private static string Describe(string accessibility, bool isStatic, bool isAbstract)
    {
        var parts = new List<string>();

        if (!string.IsNullOrEmpty(accessibility))
        {
            parts.Add(accessibility);
        }

        if (isStatic)
        {
            parts.Add("static");
        }

        if (isAbstract)
        {
            parts.Add("abstract");
        }

        return parts.Count == 0 ? "" : $" ({string.Join(" ", parts)})";
    }
}
