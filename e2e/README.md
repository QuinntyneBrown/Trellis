# Trellis E2E Tests

The E2E suite uses Playwright to test Trellis as a complete browser workflow.

## Install

```powershell
npm ci
npx playwright install
```

## Run

```powershell
npm test
```

Useful variants:

```powershell
npm run test:headed
npm run test:ui
npm run report
```

## Server Lifecycle

[playwright.config.ts](playwright.config.ts) starts both application servers:

- Backend: `dotnet run --project ../backend/src/Trellis.Api --urls=http://localhost:5000`
- Frontend: `npm start` in `../frontend`

The backend runs with `ASPNETCORE_ENVIRONMENT=E2E`, so its startup path resets and migrates the SQLite database before `/health` reports ready.

The suite runs with a single Playwright worker by design. The tests exercise real PlantUML Java rendering, and serial execution keeps render timing deterministic across local machines and CI agents.
