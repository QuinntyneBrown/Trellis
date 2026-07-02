# Architecture

Trellis is a browser-based diagram-as-code workspace. The system is split into an Angular frontend, an ASP.NET Core backend, a SignalR render channel, and a local SQLite document store.

## System Overview

```text
Angular app
  |-- REST over /api for documents and templates
  |-- SignalR over /hubs/plantuml for render requests

ASP.NET Core API (single Trellis.Api project)
  |-- Controllers for document and template APIs (EF Core work inline)
  |-- SignalR hub for render requests
  |-- Persistence folder for the SQLite EF Core context and migrations
  |-- PlantUml folder for the renderer and its options
  |-- Templates folder for the vendored starter-template catalog

Vendored renderer assets
  |-- plantuml.jar
  |-- C4-PlantUML include files
  |-- starter templates
```

## Backend Structure

The backend is a single `Trellis.Api` project, deliberately kept as plain
controllers + services (no mediator, no separate Application/Domain/
Infrastructure projects — the app has one entity and nine operations):

- `Controllers` own the HTTP surface; each action is a few lines of EF Core
  work against `ApplicationDbContext` directly. Request validation is plain
  DataAnnotations on the `Contracts` request records; not-found is a null
  check returning 404.
- `Hubs/PlantUmlHub` owns the render path and is its single catch-all
  boundary; it injects `IPlantUmlRenderer` directly, with two inline guards
  for empty/oversized source.
- `Domain/PlantUmlDocument` is both the persisted entity and the JSON shape
  the document endpoints return.
- `Persistence` holds the EF Core context, entity configuration, migrations,
  and the startup initialiser; `PlantUml` holds the renderer; `Templates`
  holds the catalog (six fixed entries, files read eagerly at construction).
- `IPlantUmlRenderer` is the one deliberate seam, so integration tests can
  substitute a fake renderer and run without a JVM.

## Rendering Flow

1. The frontend submits PlantUML source to the SignalR hub method `RenderDiagram`.
2. The hub validates the source inline (non-empty, at most 100k characters).
3. The hub calls the renderer with the connection's abort token, so a render for a disconnected client is cancelled and its process killed.
4. The renderer starts the vendored PlantUML JAR through the configured Java executable.
5. PlantUML receives source through standard input and returns SVG through standard output.
6. The backend returns either SVG content or a structured failure message to the frontend.

Rendering is bounded by a timeout and a concurrency limiter so render bursts cannot create unbounded Java processes.

## Persistence

Documents are stored in SQLite through Entity Framework Core. The default connection string writes to an `App_Data` database path. The E2E environment resets and migrates the database on startup so Playwright runs begin from a clean state.

## Frontend Structure

The Angular application is organized around:

- `core` services and models (HTTP, SignalR, Monaco loading, layout preferences, File System Access).
- `features/editor` for the Monaco editor, toolbar rail, save dialog, resize divider, and diagram preview. The editor page owns document loading directly from the URL's `documentId` — there is no route resolver or custom route-reuse strategy.
- `features/documents` for the saved-documents side panel (list, open, rename, delete).
- `features/explorer` for browsing and editing local folders via the File System Access API.
- `features/templates` for selecting starter diagrams.
- `shared` components for reusable status, loading, and error UI.

Development uses relative `/api` and `/hubs` URLs with the Angular proxy configuration. Production environment values are expected to be supplied by deployment configuration.

## Vendored Assets

Trellis vendors PlantUML and C4-PlantUML assets so the local development and E2E workflows are deterministic. These components retain their upstream licenses and are documented in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

