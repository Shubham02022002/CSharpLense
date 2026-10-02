namespace CSharpLens.Domain.Models;

public enum CodeTypeKind
{
    Class,
    Interface,
    Struct,
    Record,
    Enum
}

public class CodeType
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Namespace { get; set; } = "";
    public CodeTypeKind Kind { get; set; }
    public string Accessibility { get; set; } = "";
    public bool IsAbstract { get; set; }
    public bool IsStatic { get; set; }

    /// <summary>Names this type inherits or implements, as written in source.</summary>
    public List<string> BaseTypes { get; set; } = [];

    public List<CodeMember> Members { get; set; } = [];

    public CodeLocation Location { get; set; } = new();
}
