# Contributing to Trellis

Trellis welcomes issues, documentation improvements, tests, and code changes that make the project easier to use and maintain.

## Before You Start

- Read the [Code of Conduct](CODE_OF_CONDUCT.md).
- Search existing issues and pull requests before opening a new one.
- Keep changes focused. Small, reviewable pull requests are easier to merge.
- Open an issue first for large features, architecture changes, dependency policy changes, or changes that affect storage compatibility.

## Development Setup

Install the required SDKs and dependencies:

```powershell
dotnet restore backend/Trellis.sln

cd frontend
npm ci
cd ..

cd e2e
npm ci
npx playwright install
cd ..
```

Run the backend:

```powershell
dotnet run --project backend/src/Trellis.Api --urls=http://localhost:5000
```

Run the frontend:

```powershell
cd frontend
npm start
```

## Coding Guidelines

- Prefer the existing project structure over introducing new framework patterns.
- Keep the backend layered: API controllers and hubs call application commands or queries; infrastructure owns persistence and renderer integration; domain entities stay framework-light.
- Keep frontend state and API access in the existing core services and feature component boundaries.
- Add tests near the behavior being changed.
- Do not commit generated build output, local databases, editor state, or temporary backup files.
- Do not change dependency licensing posture casually. The backend intentionally pins some packages to avoid license changes.

## Tests

Run the relevant tests before opening a pull request:

```powershell
dotnet test backend/Trellis.sln
```

```powershell
cd frontend
npm test
```

```powershell
cd e2e
npm test
```

If a test cannot be run locally, document the reason in the pull request.

## Pull Request Expectations

A pull request should include:

- A clear description of the user-visible behavior or maintenance change.
- Tests or an explanation of why tests are not appropriate.
- Documentation updates when commands, configuration, deployment behavior, or contributor workflow changes.
- Screenshots or short recordings for substantial UI changes.
- A note for any security, licensing, migration, or compatibility concerns.

## Licensing

Unless you state otherwise, contributions submitted to this repository are provided under the same license as the project. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

