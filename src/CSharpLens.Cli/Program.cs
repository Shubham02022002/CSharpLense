using CSharpLens.Cli.Analysis;

var filePath = args.Length > 0
    ? args[0]
    : "Book.cs";

if (!File.Exists(filePath))
{
    Console.WriteLine($"File not found: {filePath}");
    return;
}

var sourceCode = await File.ReadAllTextAsync(filePath);

ICSharpAnalyzer analyzer = new RoslynCSharpAnalyzer();

var analysis = await analyzer.AnalyzeAsync(sourceCode);

foreach (var type in analysis.Types)
{
    Console.WriteLine($"{type.Kind}: {type.Name}");

    foreach (var member in type.Members)
    {
        Console.WriteLine(
            $"  {member.Kind}: {member.Name} {member.ReturnType}");
    }

    Console.WriteLine();
}

Console.WriteLine("Relationships:");

foreach (var relationship in analysis.Relationships)
{
    var source = analysis.Types
        .First(x => x.Id == relationship.SourceId);

    var target = analysis.Types
        .First(x => x.Id == relationship.TargetId);

    Console.WriteLine(
        $"  {source.Name} --{relationship.Type}--> {target.Name}");
}

Console.WriteLine("\nDiagnostics:");

foreach (var diagnostic in analysis.Diagnostics)
{
    Console.WriteLine(
        $"  {diagnostic.Id} [{diagnostic.Severity}] " +
        $"Line {diagnostic.StartLine}, Column {diagnostic.StartColumn}: " +
        diagnostic.Message);
}