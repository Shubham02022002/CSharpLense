namespace CSharpLens.Domain.Models;

public enum RelationshipType
{
    Inheritance,
    Implementation,
    Dependency
}

public class CodeRelationship
{
    public Guid SourceId { get; set; }

    public Guid TargetId { get; set; }

    public RelationshipType Type { get; set; }
}