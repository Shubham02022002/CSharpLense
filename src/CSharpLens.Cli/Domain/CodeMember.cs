namespace CSharpLens.Cli.Domain;

public enum CodeMemberKind
{
    Constructor,
    Method,
    Property,
    Field
}

public class CodeMember
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = "";

    public CodeMemberKind Kind { get; set; }

    public string ReturnType { get; set; } = "";

    public List<string> Parameters { get; set; } = [];
}