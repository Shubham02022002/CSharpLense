namespace CSharpLens.Domain.Models;

public class CodeDiagnostic
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>Compiler diagnostic id, e.g. <c>CS0103</c>.</summary>
    public string Code { get; set; } = "";

    public string Message { get; set; } = "";

    public string Severity { get; set; } = "";

    public CodeLocation Location { get; set; } = new();
}
