using CSharpLens.Domain.Models;
using Microsoft.Extensions.Caching.Memory;

namespace CSharpLens.Api;

/// <summary>Holds analyses by id. Only the derived model is kept, never the source.</summary>
public interface IAnalysisStore
{
    void Save(CodeAnalysis analysis);

    CodeAnalysis? Get(Guid id);
}

public class InMemoryAnalysisStore : IAnalysisStore
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromHours(2);

    private readonly IMemoryCache _cache;

    public InMemoryAnalysisStore(IMemoryCache cache)
    {
        _cache = cache;
    }

    public void Save(CodeAnalysis analysis) =>
        _cache.Set(Key(analysis.Id), analysis, new MemoryCacheEntryOptions
        {
            SlidingExpiration = Lifetime,
            Size = 1
        });

    public CodeAnalysis? Get(Guid id) =>
        _cache.TryGetValue(Key(id), out CodeAnalysis? analysis) ? analysis : null;

    private static string Key(Guid id) => $"analysis:{id}";
}
