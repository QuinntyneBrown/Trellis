# Trellis

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![.NET](https://img.shields.io/badge/.NET-8.0-512BD4.svg)](backend/global.json)
[![Angular](https://img.shields.io/badge/Angular-17-DD0031.svg)](frontend/package.json)

Trellis is an open-source workspace for authoring, rendering, and managing PlantUML diagrams. It combines a Monaco-powered Angular editor, a real-time ASP.NET Core rendering service, built-in PlantUML and C4 templates, and a local document library for saving and revisiting diagrams.

The project is intended for teams that prefer diagram-as-code workflows but still need a responsive browser-based editing experience.

## Features

- Live PlantUML-to-SVG rendering through SignalR.
- Built-in starter templates for blank, sequence, class, and C4 diagrams.
- Local document persistence backed by SQLite and Entity Framework Core.
- Upload support for `.puml` and `.txt` diagrams.
- Syntax failure handling that reports render errors without breaking the editor session.
- Focused unit, integration, and Playwright end-to-end coverage.

## Project Status

Trellis is in active development. Public APIs, storage schema, and deployment conventions may change until the first stable release is tagged. The `main` branch is the source of truth for current development.

## Repository Layout

```text
backend/   ASP.NET Core API, application layer, domain model, infrastructure, tests, and vendored renderer assets.
frontend/  Angular application, shared UI components, editor experience, and Jest tests.
e2e/       Playwright test suite that runs the frontend and backend together.
docs/      Architecture, development, and testing documentation.
```

## Requirements

- .NET SDK `8.0.422` as pinned by [backend/global.json](backend/global.json).
- Node.js 20 or later with npm.
- Java runtime available on `PATH` as `java` for PlantUML rendering.
- Playwright browser dependencies for end-to-end tests.
- Graphviz is optional, but recommended for PlantUML diagram types that require DOT layout support.

## Running on Windows

These steps take a Windows 10/11 machine with nothing installed to a running instance of Trellis, using PowerShell.

### 1. Install dependencies

**Option A: winget (recommended)**

Open PowerShell and run each line:

```powershell
winget install --id Git.Git -e
winget install --id Microsoft.DotNet.SDK.8 -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id EclipseAdoptium.Temurin.17.JRE -e
winget install --id Graphviz.Graphviz -e
```

- `Microsoft.DotNet.SDK.8` installs the latest .NET 8 SDK; [backend/global.json](backend/global.json) pins the exact patch version (`8.0.422`) that `dotnet` will roll forward to within the 8.x line.
- `EclipseAdoptium.Temurin.17.JRE` provides the `java` executable that the backend shells out to for rendering PlantUML diagrams (see `PlantUml:JavaExecutablePath` in [Configuration](#configuration)). Any modern JRE or JDK on `PATH` as `java` works.
- Graphviz is optional; it's only needed for PlantUML diagram types that require DOT layout (e.g., activity or use case diagrams).

Close and reopen your terminal after installing so `PATH` changes take effect.

**Option B: manual installers**

If `winget` isn't available, install each of the following from its official site and accept the default options (which add the tool to `PATH`): Git, the .NET 8 SDK, Node.js 20 LTS, a Java runtime (e.g. Eclipse Temurin 17), and Graphviz (optional).

### 2. Verify the toolchain

```powershell
git --version
dotnet --version
node --version
npm --version
java -version
```

`dotnet --version` should report an `8.x` SDK. `java -version` must succeed in the terminal you'll use to run the API — PlantUML rendering fails immediately if Java isn't resolvable on `PATH`.

### 3. Clone the repository and install project dependencies

```powershell
git clone https://github.com/QuinntyneBrown/Trellis.git
cd Trellis

dotnet restore backend/Trellis.sln

cd frontend
npm ci
cd ..

cd e2e
npm ci
npx playwright install
cd ..
```

### 4. Run the app

Open two PowerShell windows.

Terminal 1 — start the API:

```powershell
dotnet run --project backend/src/Trellis.Api --urls=http://localhost:5000
```

Terminal 2 — start the frontend:

```powershell
cd frontend
npm start
```

Open `http://localhost:4200`. The Angular dev server proxies `/api` and `/hubs` to the backend on `http://localhost:5000`.

### Troubleshooting

- **PlantUML renders fail immediately** — confirm `java -version` succeeds in the same terminal running the API. If Java is installed but not on `PATH`, set `PlantUml:JavaExecutablePath` in [backend/src/Trellis.Api/appsettings.json](backend/src/Trellis.Api/appsettings.json) to the full path of `java.exe`.
- **Port already in use** — pass a different `--urls` value to `dotnet run`, or find and stop the process holding the port: `Get-Process -Id (Get-NetTCPConnection -LocalPort 5000).OwningProcess`.
- **`npm ci` fails** — confirm `node --version` is 20 or later, delete the `node_modules` folder, and rerun `npm ci`.

## Testing

Run backend tests:

```powershell
dotnet test backend/Trellis.sln
```

Run frontend unit tests:

```powershell
cd frontend
npm test
```

Run end-to-end tests:

```powershell
cd e2e
npm test
```

The Playwright configuration starts the API and frontend automatically and resets the E2E database on backend startup.

## Configuration

Runtime configuration is owned by [backend/src/Trellis.Api/appsettings.json](backend/src/Trellis.Api/appsettings.json). The most commonly changed settings are:

| Setting | Purpose |
| --- | --- |
| `ConnectionStrings:DefaultConnection` | SQLite database path used by the API. |
| `Cors:AllowedOrigins` | Frontend origins allowed to call the API and SignalR hub. |
| `PlantUml:JavaExecutablePath` | Java executable used to run the vendored PlantUML JAR. |
| `PlantUml:RenderTimeoutSeconds` | Maximum time allowed for a single render operation. |
| `PlantUml:MaxConcurrentRenders` | Maximum concurrent PlantUML render processes. |

Production frontend URLs are configured in [frontend/src/environments/environment.ts](frontend/src/environments/environment.ts). Development uses relative URLs and the Angular proxy configuration.

## Documentation

- [Architecture](docs/architecture.md)
- [Development Guide](docs/development.md)
- [Testing Guide](docs/testing.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Support](SUPPORT.md)
- [Governance](GOVERNANCE.md)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request, and follow the [Code of Conduct](CODE_OF_CONDUCT.md) in all project spaces.

## Security

Do not report suspected vulnerabilities in public issues. Follow the private reporting guidance in [SECURITY.md](SECURITY.md).

## License

Original Trellis source code and documentation are licensed under the [MIT License](LICENSE). Vendored and package-managed third-party components remain under their own licenses. See [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

