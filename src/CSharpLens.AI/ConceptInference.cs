using System.Text.RegularExpressions;
using CSharpLens.Domain.Models;

namespace CSharpLens.AI;

/// <summary>Names the OOP concepts a set of types illustrates, from Roslyn alone.</summary>
public static class ConceptInference
{
    private static readonly Regex IdentifierPattern = new(
        "[A-Za-z_][A-Za-z0-9_]*",
        RegexOptions.Compiled);

    public static List<string> Infer(CodeAnalysis analysis, IEnumerable<Guid> nodeIds)
    {
        var concepts = new List<string>();

        var interfaceNames = analysis.Types
            .Where(t => t.Kind == CodeTypeKind.Interface)
            .Select(t => t.Name)
            .ToList();

        foreach (var type in TypesFor(analysis, nodeIds))
        {
            // BaseTypes merges base classes with interfaces; the relationships don't.
            var bases = analysis.Relationships.Where(r => r.SourceId == type.Id).ToList();

            if (bases.Any(r => r.Type == RelationshipType.Inheritance))
            {
                concepts.Add("Inheritance");
            }

            if (bases.Any(r => r.Type == RelationshipType.Implementation))
            {
                concepts.Add(type.Kind == CodeTypeKind.Interface
                    ? "Interface Inheritance"
                    : "Interface Implementation");
            }

            var takesDependencies = type.Members.Any(
                m => m.Kind == CodeMemberKind.Constructor && m.Parameters.Count > 0);

            if (takesDependencies)
            {
                concepts.Add("Dependency Injection");
            }

            var dependsOnAbstraction = type.Members
                .Where(m => m.Kind is CodeMemberKind.Field or CodeMemberKind.Property)
                .Any(m => interfaceNames.Any(name => MentionsType(m.ReturnType, name)));

            if (dependsOnAbstraction)
            {
                concepts.Add("Dependency Inversion");
                concepts.Add("Programming to an Interface");
            }

            var isImplemented = analysis.Relationships.Any(
                r => r.TargetId == type.Id && r.Type != RelationshipType.Dependency);

            if (isImplemented)
            {
                concepts.Add("Polymorphism");
            }

            var hidesState = type.Members.Any(
                m => m.Kind == CodeMemberKind.Field && m.Accessibility == "private");

            var exposesBehaviour = type.Members.Any(m => m.Accessibility == "public");

            if (hidesState && exposesBehaviour)
            {
                concepts.Add("Encapsulation");
            }
        }

        return concepts.Distinct().ToList();
    }

    /// <summary>Whole-identifier match, so "Store" does not match "OrderStore".</summary>
    public static bool MentionsType(string written, string name)
    {
        foreach (Match match in IdentifierPattern.Matches(written))
        {
            if (string.Equals(match.Value, name, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    private static IEnumerable<CodeType> TypesFor(
        CodeAnalysis analysis,
        IEnumerable<Guid> nodeIds)
    {
        var ids = nodeIds.ToHashSet();

        return analysis.Types.Where(
            t => ids.Contains(t.Id) || t.Members.Any(m => ids.Contains(m.Id)));
    }
}
