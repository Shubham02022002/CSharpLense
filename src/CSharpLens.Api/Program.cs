using CSharpLens.Analysis;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();

builder.Services.AddSingleton<ICSharpAnalyzer, RoslynCSharpAnalyzer>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.MapPost("/api/analyze", async (
    AnalyzeRequest request,
    ICSharpAnalyzer analyzer,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.SourceCode))
    {
        return Results.BadRequest(new
        {
            error = "Source code cannot be empty."
        });
    }

    var analysis = await analyzer.AnalyzeAsync(
        request.SourceCode,
        cancellationToken);

    return Results.Ok(analysis);
});

app.Run();

public record AnalyzeRequest(string SourceCode);