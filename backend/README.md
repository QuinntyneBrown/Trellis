# Trellis Backend

The Trellis backend is an ASP.NET Core 8 application that exposes document APIs, template APIs, a SignalR PlantUML rendering hub, SQLite persistence, and the vendored renderer integration.

## Projects

- `src/Trellis.Api` - HTTP API, SignalR hub, configuration, startup, and exception handling.
- `src/Trellis.Application` - commands, queries, validation, application models, and interfaces.
- `src/Trellis.Domain` - core domain entities.
- `src/Trellis.Infrastructure` - Entity Framework Core, template catalog, PlantUML renderer, and infrastructure services.
- `tests/Trellis.Application.Tests` - application-level unit tests.
- `tests/Trellis.Api.IntegrationTests` - API integration tests.

## Run

```powershell
dotnet run --project src/Trellis.Api --urls=http://localhost:5000
```

From the repository root:

```powershell
dotnet run --project backend/src/Trellis.Api --urls=http://localhost:5000
```

## Test

```powershell
dotnet test Trellis.sln
```

From the repository root:

```powershell
dotnet test backend/Trellis.sln
```

## Configuration

Configuration is defined in `src/Trellis.Api/appsettings.json` and environment-specific overrides. Important sections:

- `ConnectionStrings:DefaultConnection`
- `Cors:AllowedOrigins`
- `PlantUml`

The `PlantUml` section controls the Java executable, vendored JAR path, C4 include path, render timeout, and render concurrency.

