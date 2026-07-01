# Architecture

Trellis is a browser-based diagram-as-code workspace. The system is split into an Angular frontend, an ASP.NET Core backend, a SignalR render channel, and a local SQLite document store.

## System Overview

```text
Angular app
  |-- REST over /api for documents and templates
  |-- SignalR over /hubs/plantuml for render requests

ASP.NET Core API
  |-- Controllers for document and template APIs
  |-- SignalR hub for render requests
  |-- Application layer commands and queries
  |-- Infrastructure layer for SQLite, template catalog, and PlantUML process execution

Vendored renderer assets
  |-- plantuml.jar
  |-- C4-PlantUML include files
  |-- starter templates and manifest
```

## Backend Layers

The backend follows a layered structure:

- `Trellis.Api` owns HTTP controllers, SignalR hubs, API contracts, exception handling, configuration, and startup.
- `Trellis.Application` owns commands, queries, validation, application models, and interfaces.
- `Trellis.Domain` owns core entities and domain primitives.
- `Trellis.Infrastructure` owns Entity Framework Core persistence, the template catalog, time provider, and PlantUML renderer implementation.

API endpoints and hubs communicate with the application layer through MediatR. Infrastructure implementations are registered through dependency injection and are consumed behind application interfaces.

## Rendering Flow

1. The frontend submits PlantUML source to the SignalR hub method `RenderDiagram`.
2. The hub dispatches a `RenderDiagramCommand`.
3. The application layer validates the request and calls the renderer abstraction.
4. The infrastructure renderer starts the vendored PlantUML JAR through the configured Java executable.
5. PlantUML receives source through standard input and returns SVG through standard output.
6. The backend returns either SVG content or a structured failure message to the frontend.

Rendering is bounded by a timeout and a concurrency limiter so render bursts cannot create unbounded Java processes.

## Persistence

Documents are stored in SQLite through Entity Framework Core. The default connection string writes to an `App_Data` database path. The E2E environment resets and migrates the database on startup so Playwright runs begin from a clean state.

## Frontend Structure

The Angular application is organized around:

- `core` services, models, resolvers, and routing infrastructure.
- `features/editor` for the Monaco editor, toolbar, save dialog, and diagram preview.
- `features/documents` for listing, renaming, opening, and managing saved diagrams.
- `features/templates` for selecting starter diagrams.
- `shared` components for reusable status, loading, and error UI.

Development uses relative `/api` and `/hubs` URLs with the Angular proxy configuration. Production environment values are expected to be supplied by deployment configuration.

## Vendored Assets

Trellis vendors PlantUML and C4-PlantUML assets so the local development and E2E workflows are deterministic. These components retain their upstream licenses and are documented in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

