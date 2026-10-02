using CSharpLens.Domain.Models;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace CSharpLens.Analysis;

public class RoslynCSharpAnalyzer : ICSharpAnalyzer
{
    public async Task<CodeAnalysis> AnalyzeAsync(
            string sourceCode,
             CancellationToken cancellationToken = default)
    {
        var syntaxTree = CSharpSyntaxTree.ParseText(sourceCode);

        var references = GetMetadataReferences();

        var compilation = CSharpCompilation.Create(
            assemblyName: "CSharpLensAnalysis",
            syntaxTrees: [syntaxTree],
            references: references,
            options: new CSharpCompilationOptions(
                OutputKind.DynamicallyLinkedLibrary));

        var semanticModel = compilation.GetSemanticModel(syntaxTree);

        var root = await syntaxTree.GetRootAsync();

        var analysis = new CodeAnalysis();

        var typeDeclarations = root.DescendantNodes()
            .OfType<BaseTypeDeclarationSyntax>()
            .ToList();

        foreach (var declaration in typeDeclarations)
        {
            var codeType = CreateCodeType(
                declaration,
                semanticModel);

            analysis.Types.Add(codeType);
        }

        BuildRelationships(
            typeDeclarations,
            semanticModel,
            analysis);

        BuildDependencies(
            typeDeclarations,
            semanticModel,
            analysis);

        BuildDiagnostics(
            compilation,
            analysis);

        return analysis;
    }

    private static IEnumerable<MetadataReference> GetMetadataReferences()
    {
        var trustedAssemblies =
            AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") as string;

        if (string.IsNullOrWhiteSpace(trustedAssemblies))
        {
            yield return MetadataReference.CreateFromFile(
                typeof(object).Assembly.Location);

            yield break;
        }

        foreach (var assemblyPath in trustedAssemblies.Split(
                     Path.PathSeparator))
        {
            yield return MetadataReference.CreateFromFile(
                assemblyPath);
        }
    }

    private static CodeType CreateCodeType(
        BaseTypeDeclarationSyntax declaration,
        SemanticModel semanticModel)
    {
        var symbol = semanticModel.GetDeclaredSymbol(declaration);

        var kind = declaration switch
        {
            InterfaceDeclarationSyntax => CodeTypeKind.Interface,
            StructDeclarationSyntax => CodeTypeKind.Struct,
            RecordDeclarationSyntax => CodeTypeKind.Record,
            EnumDeclarationSyntax => CodeTypeKind.Enum,
            _ => CodeTypeKind.Class
        };

        var codeType = new CodeType
        {
            Name = symbol?.Name ?? declaration.Identifier.Text,
            Kind = kind
        };

        if (declaration is TypeDeclarationSyntax typeDeclaration)
        {
            foreach (var member in typeDeclaration.Members)
            {
                var codeMember = CreateCodeMember(member);

                if (codeMember is not null)
                {
                    codeType.Members.Add(codeMember);
                }
            }
        }

        return codeType;
    }

    private static CodeMember? CreateCodeMember(
            MemberDeclarationSyntax member)
    {
        return member switch
        {
            PropertyDeclarationSyntax property => new CodeMember
            {
                Name = property.Identifier.Text,
                Kind = CodeMemberKind.Property,
                ReturnType = property.Type.ToString()
            },

            FieldDeclarationSyntax field => new CodeMember
            {
                Name = field.Declaration.Variables
                    .First()
                    .Identifier
                    .Text,

                Kind = CodeMemberKind.Field,
                ReturnType = field.Declaration.Type.ToString()
            },

            ConstructorDeclarationSyntax constructor => new CodeMember
            {
                Name = constructor.Identifier.Text,
                Kind = CodeMemberKind.Constructor
            },

            MethodDeclarationSyntax method => new CodeMember
            {
                Name = method.Identifier.Text,
                Kind = CodeMemberKind.Method,
                ReturnType = method.ReturnType.ToString()
            },

            _ => null
        };
    }

    private static void BuildRelationships(
        List<BaseTypeDeclarationSyntax> declarations,
        SemanticModel semanticModel,
        CodeAnalysis analysis)
    {
        foreach (var declaration in declarations)
        {
            var sourceSymbol =
                semanticModel.GetDeclaredSymbol(declaration);

            if (sourceSymbol is null)
                continue;

            var sourceType = analysis.Types
                .FirstOrDefault(x => x.Name == sourceSymbol.Name);

            if (sourceType is null)
                continue;

            if (declaration is TypeDeclarationSyntax typeDeclaration &&
                typeDeclaration.BaseList is not null)
            {
                foreach (var baseType in typeDeclaration.BaseList.Types)
                {
                    var targetSymbol =
                        semanticModel.GetTypeInfo(baseType.Type).Type;

                    if (targetSymbol is null)
                        continue;

                    var targetType = analysis.Types
                        .FirstOrDefault(x => x.Name == targetSymbol.Name);

                    if (targetType is null)
                        continue;

                    var relationshipType =
                        targetSymbol.TypeKind == TypeKind.Interface
                            ? RelationshipType.Implementation
                            : RelationshipType.Inheritance;

                    analysis.Relationships.Add(
                        new CodeRelationship
                        {
                            SourceId = sourceType.Id,
                            TargetId = targetType.Id,
                            Type = relationshipType
                        });
                }
            }
        }
    }

    private static void BuildDependencies(
        List<BaseTypeDeclarationSyntax> declarations,
        SemanticModel semanticModel,
        CodeAnalysis analysis)
    {
        foreach (var declaration in declarations)
        {
            var sourceSymbol =
                semanticModel.GetDeclaredSymbol(declaration);

            if (sourceSymbol is null)
                continue;

            var sourceType = analysis.Types
                .FirstOrDefault(x => x.Name == sourceSymbol.Name);

            if (sourceType is null)
                continue;

            if (declaration is not TypeDeclarationSyntax typeDeclaration)
                continue;

            foreach (var member in typeDeclaration.Members)
            {
                if (member is not FieldDeclarationSyntax field)
                    continue;

                var fieldType =
                    semanticModel
                        .GetTypeInfo(field.Declaration.Type)
                        .Type;

                if (fieldType is null)
                    continue;

                var targetType = analysis.Types
                    .FirstOrDefault(x => x.Name == fieldType.Name);

                if (targetType is null)
                    continue;

                analysis.Relationships.Add(
                    new CodeRelationship
                    {
                        SourceId = sourceType.Id,
                        TargetId = targetType.Id,
                        Type = RelationshipType.Dependency
                    });
            }
        }
    }

    private static void BuildDiagnostics(
        Compilation compilation,
        CodeAnalysis analysis)
    {
        var diagnostics = compilation.GetDiagnostics();

        foreach (var diagnostic in diagnostics)
        {
            if (diagnostic.Severity == DiagnosticSeverity.Hidden)
                continue;

            var lineSpan = diagnostic.Location.GetLineSpan();

            var line = lineSpan.StartLinePosition;

            analysis.Diagnostics.Add(
                new CodeDiagnostic
                {
                    Id = diagnostic.Id,
                    Message = diagnostic.GetMessage(),
                    Severity = diagnostic.Severity.ToString(),
                    StartLine = line.Line + 1,
                    StartColumn = line.Character + 1
                });
        }
    }
}