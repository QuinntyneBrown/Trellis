# Development Guide

This guide covers the local development loop for Trellis.

## Prerequisites

- .NET SDK `8.0.422`.
- Node.js 20 or later.
- npm.
- Java available as `java` on `PATH`.
- Playwright browsers for E2E test execution.

Check local versions:

```powershell
dotnet --version
node --version
npm --version
java -version
```

## Install Dependencies

From the repository root:

```powershell
dotnet restore backend/Trellis.sln
```

```powershell
cd frontend
npm ci
cd ..
```

```powershell
cd e2e
npm ci
npx playwright install
cd ..
```

## Run Locally

Start the backend:

```powershell
dotnet run --project backend/src/Trellis.Api --urls=http://localhost:5000
```

Render a PlantUML file from the repository root:

```powershell
dotnet run --project backend/src/Trellis.Cli -- render diagrams/example.puml
```

The released tool can instead be installed with
`dotnet tool install --global Trellis.Cli` and invoked as `trellis`.

The default output is `diagrams/example.png`. Use `--output` (or `-o`) to
select another existing directory; an existing PNG is replaced after a
successful render.

Start the frontend:

```powershell
cd frontend
npm start
```

Open `http://localhost:4200`.

## Database Behavior

The default SQLite database is created under the configured `App_Data` path when the API starts. Runtime database files are ignored by Git.

When `ASPNETCORE_ENVIRONMENT=E2E`, the API resets and migrates the database on startup. This is intentional for repeatable Playwright runs.

## Common Commands

Build the backend:

```powershell
dotnet build backend/Trellis.sln
```

Run backend tests:

```powershell
dotnet test backend/Trellis.sln
```

Run frontend unit tests:

```powershell
cd frontend
npm test
```

Build the frontend:

```powershell
cd frontend
npm run build
```

Run E2E tests:

```powershell
cd e2e
npm test
```

## Troubleshooting

### PlantUML renders fail immediately

Confirm Java is available:

```powershell
java -version
```

If Java is installed outside `PATH`, set `PlantUml:JavaExecutablePath` in API configuration.
For the CLI, set the `PlantUml__JavaExecutablePath` environment variable.

### The frontend cannot reach the API

Confirm the backend is listening on `http://localhost:5000` and that [frontend/proxy.conf.json](../frontend/proxy.conf.json) points to that URL.

### E2E tests reuse stale services

Playwright reuses existing servers outside CI. Stop any local backend or frontend instances if a test run appears to use stale code.
