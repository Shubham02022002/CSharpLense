namespace CSharpLens.Cli.Domain;

public class CodeAnalysis
{
    public List<CodeType> Types { get; set; } = [];

    public List<CodeRelationship> Relationships { get; set; } = [];

    public List<CodeDiagnostic> Diagnostics { get; set; } = [];
}