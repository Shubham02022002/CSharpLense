using CSharpLens.Domain.Models;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace CSharpLens.Analysis;

public class RoslynCSharpAnalyzer : ICSharpAnalyzer
{
    // Building metadata references for every trusted platform assembly is the
    // expensive part of analysis and the set never changes, so share it.
    private static readonly Lazy<IReadOnlyList<MetadataReference>> CachedReferences =
        new(BuildReferences, isThreadSafe: true);

    private static readonly SymbolEqualityComparer SymbolComparer =
        SymbolEqualityComparer.Default;

    public async Task<CodeAnalysis> AnalyzeAsync(
            string sourceCode,
             CancellationToken cancellationToken = default)
    {
        var syntaxTree = CSharpSyntaxTree.ParseText(sourceCode, cancellationToken: cancellationToken);

        var compilation = CSharpCompilation.Create(
            assemblyName: "CSharpLensAnalysis",
            syntaxTrees: [syntaxTree],
            references: CachedReferences.Value,
            options: new CSharpCompilationOptions(
                OutputKind.DynamicallyLinkedLibrary));

        var semanticModel = compilation.GetSemanticModel(syntaxTree);

        var root = await syntaxTree.GetRootAsync(cancellationToken);

        var analysis = new CodeAnalysis();

        var typeDeclarations = root.DescendantNodes()
            .OfType<BaseTypeDeclarationSyntax>()
            .ToList();

        // Map declarations to their symbols so relationship detection can resolve
        // targets precisely rather than by (ambiguous) type name.
        var typeByDeclaration = new Dictionary<SyntaxNode, CodeType>();
        var typeBySymbol = new Dictionary<ISymbol, CodeType>(SymbolComparer);

        foreach (var declaration in typeDeclarations)
        {
            var codeType = CreateCodeType(declaration, semanticModel);

            typeByDeclaration[declaration] = codeType;
            analysis.Types.Add(codeType);

            var symbol = semanticModel.GetDeclaredSymbol(declaration, cancellationToken);

            if (symbol is not null)
            {
                typeBySymbol[symbol] = codeType;
            }
        }

        BuildRelationships(typeDeclarations, semanticModel, typeByDeclaration, typeBySymbol, analysis);
        BuildDependencies(typeDeclarations, semanticModel, typeByDeclaration, typeBySymbol, analysis);
        BuildDiagnostics(compilation, analysis);

        return analysis;
    }

    private static IReadOnlyList<MetadataReference> BuildReferences()
    {
        var references = new List<MetadataReference>();

        var trustedAssemblies =
            AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") as string;

        if (string.IsNullOrWhiteSpace(trustedAssemblies))
        {
            references.Add(MetadataReference.CreateFromFile(typeof(object).Assembly.Location));
            return references;
        }

        foreach (var assemblyPath in trustedAssemblies.Split(Path.PathSeparator))
        {
            references.Add(MetadataReference.CreateFromFile(assemblyPath));
        }

        return references;
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
            Namespace = GetNamespace(declaration),
            Kind = kind,
            Accessibility = GetAccessibility(symbol),
            IsAbstract = symbol?.IsAbstract ?? false,
            IsStatic = symbol?.IsStatic ?? false,
            BaseTypes = GetBaseTypes(symbol),
            Location = GetLocation(declaration)
        };

        if (declaration is RecordDeclarationSyntax { ParameterList: { } parameterList })
        {
            // Positional records declare their properties in the parameter list,
            // which does not appear in Members.
            foreach (var parameter in parameterList.Parameters)
            {
                codeType.Members.Add(new CodeMember
                {
                    Name = parameter.Identifier.Text,
                    Kind = CodeMemberKind.Property,
                    ReturnType = parameter.Type?.ToString() ?? "",
                    Accessibility = "public",
                    Location = GetLocation(parameter)
                });
            }
        }

        if (declaration is EnumDeclarationSyntax enumDeclaration)
        {
            foreach (var enumMember in enumDeclaration.Members)
            {
                codeType.Members.Add(new CodeMember
                {
                    Name = enumMember.Identifier.Text,
                    Kind = CodeMemberKind.Field,
                    ReturnType = codeType.Name,
                    Accessibility = "public",
                    Location = GetLocation(enumMember)
                });
            }
        }

        if (declaration is TypeDeclarationSyntax typeDeclaration)
        {
            foreach (var member in typeDeclaration.Members)
            {
                var codeMember = CreateCodeMember(member, semanticModel);

                if (codeMember is not null)
                {
                    codeType.Members.Add(codeMember);
                }
            }
        }

        return codeType;
    }

    private static CodeMember? CreateCodeMember(
        MemberDeclarationSyntax member,
        SemanticModel semanticModel)
    {
        // A field's symbol belongs to its declarator, not the declaration.
        var symbol = member switch
        {
            FieldDeclarationSyntax field =>
                semanticModel.GetDeclaredSymbol(field.Declaration.Variables[0]),
            EventFieldDeclarationSyntax eventField =>
                semanticModel.GetDeclaredSymbol(eventField.Declaration.Variables[0]),
            _ => semanticModel.GetDeclaredSymbol(member)
        };

        var accessibility = GetAccessibility(symbol);

        return member switch
        {
            PropertyDeclarationSyntax property => new CodeMember
            {
                Name = property.Identifier.Text,
                Kind = CodeMemberKind.Property,
                ReturnType = property.Type.ToString(),
                Accessibility = accessibility,
                IsStatic = symbol?.IsStatic ?? false,
                Location = GetLocation(property)
            },

            IndexerDeclarationSyntax indexer => new CodeMember
            {
                Name = "this[]",
                Kind = CodeMemberKind.Property,
                ReturnType = indexer.Type.ToString(),
                Accessibility = accessibility,
                Location = GetLocation(indexer)
            },

            FieldDeclarationSyntax field => new CodeMember
            {
                Name = field.Declaration.Variables.First().Identifier.Text,
                Kind = CodeMemberKind.Field,
                ReturnType = field.Declaration.Type.ToString(),
                Accessibility = accessibility,
                IsStatic = symbol?.IsStatic ?? false,
                Location = GetLocation(field)
            },

            EventFieldDeclarationSyntax eventField => new CodeMember
            {
                Name = eventField.Declaration.Variables.First().Identifier.Text,
                Kind = CodeMemberKind.Event,
                ReturnType = eventField.Declaration.Type.ToString(),
                Accessibility = accessibility,
                IsStatic = symbol?.IsStatic ?? false,
                Location = GetLocation(eventField)
            },

            EventDeclarationSyntax @event => new CodeMember
            {
                Name = @event.Identifier.Text,
                Kind = CodeMemberKind.Event,
                ReturnType = @event.Type.ToString(),
                Accessibility = accessibility,
                Location = GetLocation(@event)
            },

            ConstructorDeclarationSyntax constructor => new CodeMember
            {
                Name = constructor.Identifier.Text,
                Kind = CodeMemberKind.Constructor,
                Accessibility = accessibility,
                Parameters = constructor.ParameterList.Parameters
                    .Select(p => p.ToString())
                    .ToList(),
                Location = GetLocation(constructor)
            },

            MethodDeclarationSyntax method => new CodeMember
            {
                Name = method.Identifier.Text,
                Kind = CodeMemberKind.Method,
                ReturnType = method.ReturnType.ToString(),
                Accessibility = accessibility,
                IsStatic = symbol?.IsStatic ?? false,
                Parameters = method.ParameterList.Parameters
                    .Select(p => p.ToString())
                    .ToList(),
                Location = GetLocation(method)
            },

            _ => null
        };
    }

    private static void BuildRelationships(
        List<BaseTypeDeclarationSyntax> declarations,
        SemanticModel semanticModel,
        Dictionary<SyntaxNode, CodeType> typeByDeclaration,
        Dictionary<ISymbol, CodeType> typeBySymbol,
        CodeAnalysis analysis)
    {
        var seen = new HashSet<(Guid, Guid, RelationshipType)>();

        foreach (var declaration in declarations)
        {
            if (declaration is not TypeDeclarationSyntax typeDeclaration ||
                typeDeclaration.BaseList is null)
            {
                continue;
            }

            if (!typeByDeclaration.TryGetValue(declaration, out var sourceType))
            {
                continue;
            }

            foreach (var baseType in typeDeclaration.BaseList.Types)
            {
                var targetSymbol = semanticModel.GetTypeInfo(baseType.Type).Type;

                if (targetSymbol is null ||
                    !typeBySymbol.TryGetValue(targetSymbol, out var targetType))
                {
                    continue;
                }

                var relationshipType =
                    targetSymbol.TypeKind == TypeKind.Interface
                        ? RelationshipType.Implementation
                        : RelationshipType.Inheritance;

                AddRelationship(analysis, seen, sourceType, targetType, relationshipType);
            }
        }
    }

    private static void BuildDependencies(
        List<BaseTypeDeclarationSyntax> declarations,
        SemanticModel semanticModel,
        Dictionary<SyntaxNode, CodeType> typeByDeclaration,
        Dictionary<ISymbol, CodeType> typeBySymbol,
        CodeAnalysis analysis)
    {
        var seen = new HashSet<(Guid, Guid, RelationshipType)>();

        foreach (var declaration in declarations)
        {
            if (!typeByDeclaration.TryGetValue(declaration, out var sourceType) ||
                declaration is not TypeDeclarationSyntax typeDeclaration)
            {
                continue;
            }

            foreach (var typeSyntax in GetReferencedTypes(typeDeclaration))
            {
                var targetSymbol = semanticModel.GetTypeInfo(typeSyntax).Type;

                if (targetSymbol is null)
                {
                    continue;
                }

                foreach (var candidate in Unwrap(targetSymbol))
                {
                    if (typeBySymbol.TryGetValue(candidate, out var targetType) &&
                        targetType.Id != sourceType.Id)
                    {
                        AddRelationship(
                            analysis,
                            seen,
                            sourceType,
                            targetType,
                            RelationshipType.Dependency);
                    }
                }
            }
        }
    }

    /// <summary>Every type syntax a declaration mentions.</summary>
    private static IEnumerable<TypeSyntax> GetReferencedTypes(
        TypeDeclarationSyntax typeDeclaration)
    {
        foreach (var member in typeDeclaration.Members)
        {
            switch (member)
            {
                case FieldDeclarationSyntax field:
                    yield return field.Declaration.Type;
                    break;

                case PropertyDeclarationSyntax property:
                    yield return property.Type;
                    break;

                case EventFieldDeclarationSyntax eventField:
                    yield return eventField.Declaration.Type;
                    break;

                case EventDeclarationSyntax @event:
                    yield return @event.Type;
                    break;

                case MethodDeclarationSyntax method:
                    yield return method.ReturnType;

                    foreach (var parameter in method.ParameterList.Parameters)
                    {
                        if (parameter.Type is not null)
                        {
                            yield return parameter.Type;
                        }
                    }

                    break;

                case ConstructorDeclarationSyntax constructor:
                    foreach (var parameter in constructor.ParameterList.Parameters)
                    {
                        if (parameter.Type is not null)
                        {
                            yield return parameter.Type;
                        }
                    }

                    break;
            }
        }
    }

    /// <summary>Flattens arrays and generic arguments to the declared types.</summary>
    private static IEnumerable<ITypeSymbol> Unwrap(ITypeSymbol type)
    {
        switch (type)
        {
            case IArrayTypeSymbol array:
                foreach (var element in Unwrap(array.ElementType))
                {
                    yield return element;
                }

                break;

            case INamedTypeSymbol named:
                yield return named;

                foreach (var argument in named.TypeArguments)
                {
                    foreach (var inner in Unwrap(argument))
                    {
                        yield return inner;
                    }
                }

                break;

            default:
                yield return type;
                break;
        }
    }

    private static void AddRelationship(
        CodeAnalysis analysis,
        HashSet<(Guid, Guid, RelationshipType)> seen,
        CodeType source,
        CodeType target,
        RelationshipType type)
    {
        if (!seen.Add((source.Id, target.Id, type)))
        {
            return;
        }

        analysis.Relationships.Add(new CodeRelationship
        {
            SourceId = source.Id,
            TargetId = target.Id,
            Type = type
        });
    }

    private static void BuildDiagnostics(
        Compilation compilation,
        CodeAnalysis analysis)
    {
        foreach (var diagnostic in compilation.GetDiagnostics())
        {
            if (diagnostic.Severity == DiagnosticSeverity.Hidden)
            {
                continue;
            }

            analysis.Diagnostics.Add(new CodeDiagnostic
            {
                Code = diagnostic.Id,
                Message = diagnostic.GetMessage(),
                Severity = diagnostic.Severity.ToString(),
                Location = GetLocation(diagnostic.Location)
            });
        }
    }

    private static CodeLocation GetLocation(SyntaxNode node) =>
        GetLocation(node.GetLocation());

    private static CodeLocation GetLocation(Location location)
    {
        var span = location.GetLineSpan();

        return new CodeLocation
        {
            StartLine = span.StartLinePosition.Line + 1,
            StartColumn = span.StartLinePosition.Character + 1,
            EndLine = span.EndLinePosition.Line + 1,
            EndColumn = span.EndLinePosition.Character + 1
        };
    }

    private static string GetNamespace(SyntaxNode node) =>
        string.Join(
            ".",
            node.Ancestors()
                .OfType<BaseNamespaceDeclarationSyntax>()
                .Select(ns => ns.Name.ToString())
                .Reverse());

    private static List<string> GetBaseTypes(ISymbol? symbol)
    {
        if (symbol is not INamedTypeSymbol named)
        {
            return [];
        }

        var baseTypes = new List<string>();

        if (named.BaseType is { } baseType &&
            baseType.SpecialType is not (
                SpecialType.System_Object or
                SpecialType.System_ValueType or
                SpecialType.System_Enum) &&
            baseType.TypeKind != TypeKind.Error)
        {
            baseTypes.Add(baseType.Name);
        }

        baseTypes.AddRange(named.Interfaces.Select(i => i.Name));

        return baseTypes;
    }

    private static string GetAccessibility(ISymbol? symbol) =>
        symbol?.DeclaredAccessibility switch
        {
            Accessibility.Public => "public",
            Accessibility.Private => "private",
            Accessibility.Protected => "protected",
            Accessibility.Internal => "internal",
            Accessibility.ProtectedOrInternal => "protected internal",
            Accessibility.ProtectedAndInternal => "private protected",
            _ => ""
        };
}
