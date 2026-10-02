using CSharpLens.Analysis;

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
    var modifiers = string.Join(
        " ",
        new[]
        {
            type.Accessibility,
            type.IsStatic ? "static" : null,
            type.IsAbstract ? "abstract" : null
        }.Where(x => !string.IsNullOrEmpty(x)));

    var qualifiedName = string.IsNullOrEmpty(type.Namespace)
        ? type.Name
        : $"{type.Namespace}.{type.Name}";

    Console.WriteLine($"{type.Kind}: {qualifiedName}  [{modifiers}]  (line {type.Location.StartLine})");

    if (type.BaseTypes.Count > 0)
    {
        Console.WriteLine($"  bases: {string.Join(", ", type.BaseTypes)}");
    }

    foreach (var member in type.Members)
    {
        var parameters = member.Parameters.Count > 0
            ? $"({string.Join(", ", member.Parameters)})"
            : "";

        var returnType = string.IsNullOrEmpty(member.ReturnType)
            ? ""
            : $" : {member.ReturnType}";

        Console.WriteLine(
            $"  {member.Kind}: {member.Name}{parameters}{returnType}" +
            $"  [line {member.Location.StartLine}]");
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
        $"  {diagnostic.Code} [{diagnostic.Severity}] " +
        $"Line {diagnostic.Location.StartLine}, Column {diagnostic.Location.StartColumn}: " +
        diagnostic.Message);
}
