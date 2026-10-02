namespace CSharpLens.Domain.Models;

public class CodeAnalysis
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public List<CodeType> Types { get; set; } = [];

    public List<CodeRelationship> Relationships { get; set; } = [];

    public List<CodeDiagnostic> Diagnostics { get; set; } = [];
}
