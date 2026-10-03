FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore against the project files alone, so editing source does not
# invalidate the restored package layer.
COPY src/CSharpLens.Api/CSharpLens.Api.csproj src/CSharpLens.Api/
COPY src/CSharpLens.AI/CSharpLens.AI.csproj src/CSharpLens.AI/
COPY src/CSharpLens.Analysis/CSharpLens.Analysis.csproj src/CSharpLens.Analysis/
COPY src/CSharpLens.Domain/CSharpLens.Domain.csproj src/CSharpLens.Domain/
COPY src/CSharpLens.Voice/CSharpLens.Voice.csproj src/CSharpLens.Voice/
RUN dotnet restore src/CSharpLens.Api/CSharpLens.Api.csproj

COPY src/ ./src/
RUN dotnet publish src/CSharpLens.Api/CSharpLens.Api.csproj \
    --configuration Release \
    --no-restore \
    --output /app/publish \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=build /app/publish ./

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 8080

# The host picks the port and passes it as PORT; 8080 is the local default.
ENTRYPOINT ["sh", "-c", "ASPNETCORE_URLS=http://0.0.0.0:${PORT:-8080} exec dotnet CSharpLens.Api.dll"]
