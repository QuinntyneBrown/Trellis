# Testing Guide

Trellis uses backend unit and integration tests, frontend Jest tests, and Playwright end-to-end tests.

## Backend

Run all backend tests:

```powershell
dotnet test backend/Trellis.sln
```

Backend tests cover application command/query behavior, validation behavior, renderer command handling, and API controller integration.

## Frontend

Run frontend tests:

```powershell
cd frontend
npm test
```

Frontend tests use Jest and focus on Angular components, services, route behavior, and UI state handling.

## End-to-end

Install Playwright browsers once:

```powershell
cd e2e
npx playwright install
```

Run E2E tests:

```powershell
npm test
```

The Playwright configuration starts:

- `dotnet run --project ../backend/src/Trellis.Api --urls=http://localhost:5000`
- `npm start` in `../frontend`

The backend runs with `ASPNETCORE_ENVIRONMENT=E2E`, which resets the database before the health endpoint becomes available.

E2E tests run with one Playwright worker. This keeps real PlantUML Java renders deterministic and avoids timing failures caused by several cold render processes competing at once.

## What to Run Before a Pull Request

Use the scope of the change to decide the test set:

- Backend-only changes: `dotnet test backend/Trellis.sln`.
- Frontend-only changes: `npm test` in `frontend`.
- Cross-stack or user-flow changes: backend tests, frontend tests, and E2E tests.
- Documentation-only changes: no automated tests required unless commands or generated artifacts changed.
