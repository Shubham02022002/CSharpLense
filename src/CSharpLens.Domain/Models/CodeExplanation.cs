namespace CSharpLens.Domain.Models;

/// <summary>An explanation. <see cref="FocusNodeIds"/> names what it is about.</summary>
public class CodeExplanation
{
    public string Answer { get; set; } = "";

    public List<Guid> FocusNodeIds { get; set; } = [];

    public List<string> Concepts { get; set; } = [];

    /// <summary>Which service produced this, e.g. <c>anthropic</c> or <c>heuristic</c>.</summary>
    public string Source { get; set; } = "";
}
