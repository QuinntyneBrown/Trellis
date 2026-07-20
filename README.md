# Trellis

Trellis is a diagram-as-code workspace with an Angular frontend, an ASP.NET Core backend,
and a command-line renderer. It provides a Monaco editor, live PlantUML and Markdown previews
over SignalR, a SQLite-backed document library, reusable templates, local-file tools,
and an "Explain This" workflow for preparing codebase context for an LLM.

[![License: MIT](https://img.shields.io/badge/license-MIT-107C10.svg)](LICENSE)
[![Angular](https://img.shields.io/badge/Angular-17-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![.NET](https://img.shields.io/badge/.NET-8-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com/)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-0078D4.svg)](CONTRIBUTING.md)

[Documentation](#documentation) | [Design system](https://jolly-plant-0a4016c0f.7.azurestaticapps.net/) | [Contributing](CONTRIBUTING.md) | [Security](SECURITY.md) | [Support](SUPPORT.md)

## About the project

Trellis gives diagram-as-code teams a responsive workspace for authoring, rendering, and organizing PlantUML diagrams and Markdown documents. The Angular application combines a VS Code-inspired editor shell with saved documents, templates, a live preview, local-file tools, and an "Explain This" panel. The ASP.NET Core API provides rendering, persistence, real-time updates, and source aggregation for public GitHub and GitLab repositories.

The repository includes architecture and development guidance, decision records, UI mocks, and a deployed design-system reference to make the product and its visual language traceable.

## Features

- Author and preview PlantUML diagrams as SVG and Markdown documents as sanitized HTML through SignalR.
- Render local `.puml` files directly to PNG with the `trellis render` command.
- Work in a Monaco-powered, VS Code-inspired editor with resizable, persisted workspace panels.
- Organize SQLite-backed documents in nested virtual folders, including drag-and-drop moves and folder exports to Markdown.
- Create, update, apply, rename, and delete templates; six PlantUML starters cover blank, sequence, class, and C4 diagrams.
- Upload `.puml`, `.plantuml`, `.txt`, `.md`, and `.markdown` files, and copy or download successful diagram previews as PNG.
- Browse, create, open, and save local files through the File System Access API in Chromium-based browsers.
- Generate an LLM-ready "Explain This" prompt from a selected local file or folder, from a public GitHub or GitLab repository, folder, or file URL, or by right-clicking a saved document folder to aggregate every document in it and its subfolders. The app loads the prompt as Markdown and lets you copy it and download its filtered source attachment.
- Run focused backend, frontend, and Playwright end-to-end test coverage.

## Getting started

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/8.0) `8.0.422`, as pinned by [backend/global.json](backend/global.json).
- [Node.js](https://nodejs.org/) 20 or later with npm.
- A Java runtime available on `PATH` as `java` for PlantUML rendering.
- [Graphviz](https://graphviz.org/) is optional, but recommended for PlantUML diagram types that require DOT layout.

### Local development

```bash
git clone https://github.com/QuinntyneBrown/Trellis.git
cd Trellis
```

Start the backend (`http://localhost:5000`):

```bash
dotnet restore backend/Trellis.sln
dotnet run --project backend/src/Trellis.Api --urls=http://localhost:5000
```

PlantUML rendering requires `java` to be resolvable from the terminal that starts the API. See the [Development Guide](docs/development.md) for configuration and troubleshooting.

Render a local PlantUML file to an adjacent PNG:

```bash
dotnet tool install --global Trellis.Cli
trellis render path/to/diagram.puml
```

For development, run the tool directly from source with
`dotnet run --project backend/src/Trellis.Cli -- render path/to/diagram.puml`.

Start the frontend (`http://localhost:4200`) in a second terminal:

```bash
cd frontend
npm ci
npm run start
```

The frontend proxy routes `/api` and `/hubs` traffic to the backend.

## Technology

| Area | Technologies |
| --- | --- |
| Frontend application | Angular 17, TypeScript, RxJS, Monaco Editor |
| Backend | ASP.NET Core 8 Web API, SignalR, System.CommandLine |
| Data layer | Entity Framework Core 8, SQLite |
| Rendering | Vendored PlantUML and C4-PlantUML through Java; Markdig for Markdown |
| Source context | Local File System Access API; GitHub and GitLab archive aggregation for "Explain This" |
| Testing | xUnit, Jest, Playwright |

## Testing

Run backend tests:

```bash
dotnet test backend/Trellis.sln
```

Run frontend unit tests:

```bash
cd frontend
npm run test
```

Run end-to-end tests:

```bash
cd e2e
npm ci
npx playwright install
npm run test
```

The Playwright configuration starts both services and resets the E2E database before a run.

## Project structure

```text
backend/                       .NET solution with API, CLI, shared rendering core, and tests
frontend/                      Angular application, editor workspace, shared components, and Jest tests
e2e/                           Playwright end-to-end suite that runs the frontend and backend together
docs/                          Architecture, development, testing, ADRs, UI mocks, and design-system sources
infra/                         Azure Static Web App infrastructure for the design-system documentation site
eng/scripts/                   Windows helpers for starting and stopping Trellis
```

## Documentation

| Document | Purpose |
| --- | --- |
| [Architecture](docs/architecture.md) | System design, rendering flow, persistence, and frontend structure |
| [Development Guide](docs/development.md) | Local setup, configuration, and development workflow |
| [Testing Guide](docs/testing.md) | Backend, frontend, and end-to-end test instructions |
| [Architecture decision records](docs/adr/) | Decisions behind product and implementation choices |
| [Defect & Change Log](docs/defects/log.md) | Issues found while exercising the app and their fixes |
| [HTML UI Mocks](docs/mocks/README.md) | Static, dependency-free references for application screens and states |
| [Trellis Design System](https://jolly-plant-0a4016c0f.7.azurestaticapps.net/) | Deployed tokens, components, and patterns reference |

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, workflow, and pull-request expectations. Participation is governed by the [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Contributors are listed in [CONTRIBUTORS.md](CONTRIBUTORS.md), and notable repository changes are tracked in [CHANGELOG.md](CHANGELOG.md).

## Security

Please do not open public issues for security vulnerabilities. Follow [SECURITY.md](SECURITY.md) to report security concerns privately.

## Governance

Project roles and decision-making expectations are documented in [GOVERNANCE.md](GOVERNANCE.md).

## License

Copyright (c) 2026 Trellis contributors. Released under the [MIT License](LICENSE).
