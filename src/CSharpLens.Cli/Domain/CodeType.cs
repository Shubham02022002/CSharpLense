namespace CSharpLens.Cli.Domain;

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

    public CodeTypeKind Kind { get; set; }

    public List<CodeMember> Members { get; set; } = [];
}