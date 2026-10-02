namespace CSharpLens.Domain.Models;

/// <summary>A 1-based span in the analyzed source file.</summary>
public class CodeLocation
{
    public int StartLine { get; set; }

    public int StartColumn { get; set; }

    public int EndLine { get; set; }

    public int EndColumn { get; set; }
}
