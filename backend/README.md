# Trellis Backend

The Trellis backend workspace contains an ASP.NET Core 8 API, a command-line renderer, and the shared PlantUML rendering core.

## Projects

- `src/Trellis.Api` - HTTP controllers, the SignalR render hub, SQLite persistence, the template catalog, and API startup.
- `src/Trellis.Core` - the shared, format-aware PlantUML renderer plus the vendored PlantUML and C4-PlantUML assets.
- `src/Trellis.Cli` - the `trellis` executable and its file-per-command command layer.
- `tests/Trellis.Api.IntegrationTests` - full HTTP round-trip tests (in-memory SQLite, fake renderer) plus hub-level tests.
- `tests/Trellis.Core.Tests` - Java-backed tests of SVG/PNG rendering and failure behavior.
- `tests/Trellis.Cli.Tests` - command parsing, file handling, output, and exit-code tests.

## Run

```powershell
dotnet run --project src/Trellis.Api --urls=http://localhost:5000
```

From the repository root:

```powershell
dotnet run --project backend/src/Trellis.Api --urls=http://localhost:5000
```

Render a PlantUML file to an adjacent PNG:

```powershell
dotnet run --project src/Trellis.Cli -- render path/to/diagram.puml
```

Choose the output path explicitly:

```powershell
dotnet run --project src/Trellis.Cli -- render path/to/diagram.puml --output path/to/diagram.png
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

The `PlantUml` section controls the Java executable, vendored JAR path, C4 include path, render timeout, and render concurrency. The CLI also accepts the corresponding environment variables, such as `PlantUml__JavaExecutablePath`.
