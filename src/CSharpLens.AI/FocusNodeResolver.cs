using System.Text.RegularExpressions;
using CSharpLens.Domain.Models;

namespace CSharpLens.AI;

/// <summary>Maps the node names an explanation refers to back onto model ids.</summary>
public static class FocusNodeResolver
{
    // Matches "Order.Checkout" but not a sentence-ending full stop.
    private static readonly Regex IdentifierPattern = new(
        "[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*",
        RegexOptions.Compiled);

    /// <summary>Recovers the nodes an explanation is about from its text.</summary>
    public static List<Guid> ResolveFromText(CodeAnalysis analysis, string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return [];
        }

        var resolved = new List<Guid>();
        var seen = new HashSet<Guid>();

        foreach (Match match in IdentifierPattern.Matches(text))
        {
            foreach (var id in ResolveOne(analysis, match.Value))
            {
                if (seen.Add(id))
                {
                    resolved.Add(id);
                }
            }
        }

        return resolved;
    }

    private static IEnumerable<Guid> ResolveOne(CodeAnalysis analysis, string rawName)
    {
        var name = rawName.Trim();

        if (string.IsNullOrEmpty(name))
        {
            yield break;
        }

        // "Type.Member"
        var separator = name.LastIndexOf('.');

        if (separator > 0)
        {
            var typeName = name[..separator];
            var memberName = name[(separator + 1)..];

            foreach (var type in analysis.Types.Where(
                         t => Matches(t.Name, typeName) || Matches(Qualify(t), typeName)))
            {
                foreach (var member in type.Members.Where(m => Matches(m.Name, memberName)))
                {
                    yield return member.Id;
                }
            }
        }

        foreach (var type in analysis.Types.Where(
                     t => Matches(t.Name, name) || Matches(Qualify(t), name)))
        {
            yield return type.Id;
        }

        // Bare member name, but only when it is unambiguous.
        var matchingMembers = analysis.Types
            .SelectMany(t => t.Members)
            .Where(m => Matches(m.Name, name))
            .ToList();

        if (matchingMembers.Count == 1)
        {
            yield return matchingMembers[0].Id;
        }
    }

    private static string Qualify(CodeType type) =>
        string.IsNullOrEmpty(type.Namespace)
            ? type.Name
            : $"{type.Namespace}.{type.Name}";

    private static bool Matches(string candidate, string name) =>
        string.Equals(candidate, name, StringComparison.OrdinalIgnoreCase);
}
