namespace CSharpLens.Domain.Models;
public class CodeDiagnostic
{
    public string Id { get; set; } = "";

    public string Message { get; set; } = "";

    public string Severity { get; set; } = "";

    public int StartLine { get; set; }

    public int StartColumn { get; set; }
}