namespace CSharpLens.Domain.Models;

public enum CodeMemberKind
{
    Constructor,
    Method,
    Property,
    Field,
    Event
}

public class CodeMember
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = "";

    public CodeMemberKind Kind { get; set; }

    public string ReturnType { get; set; } = "";

    public string Accessibility { get; set; } = "";

    public bool IsStatic { get; set; }

    public List<string> Parameters { get; set; } = [];

    public CodeLocation Location { get; set; } = new();
}
