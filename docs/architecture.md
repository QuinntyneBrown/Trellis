# Architecture

Trellis is a diagram-as-code workspace. The system is split into an Angular frontend, an ASP.NET Core API, a command-line renderer, a shared rendering core, a SignalR render channel, and a local SQLite document store.

## System Overview

```text
Angular app
  |-- REST over /api for documents and templates
  |-- SignalR over /hubs/plantuml for render requests

ASP.NET Core API (Trellis.Api)
  |-- Controllers for document and template APIs (EF Core work inline)
  |-- SignalR hub for render requests
  |-- Persistence folder for the SQLite EF Core context and migrations
  |-- Markdown folder for the Markdig-based markdown renderer

Trellis.Core
  |-- Format-aware PlantUML process renderer
  |-- Microsoft.Extensions registration and options
  |-- plantuml.jar
  |-- C4-PlantUML include files

Trellis.Cli
  |-- System.CommandLine command tree
  |-- `render` command for .puml-to-.png conversion
```

## Backend Structure

The API remains deliberately plain controllers plus services. Only rendering
concerns shared with the CLI are extracted into `Trellis.Core`:

- `Controllers` own the HTTP surface; each action is a few lines of EF Core
  work against `ApplicationDbContext` directly. Request validation is plain
  DataAnnotations on the `Contracts` request records; not-found is a null
  check returning 404.
- `Hubs/PlantUmlHub` owns the render path and is its single catch-all
  boundary; it injects `IPlantUmlRenderer` directly, with two inline guards
  for empty/oversized source.
- `Domain/PlantUmlDocument` is both the persisted entity and the JSON shape
  the document endpoints return.
- `Persistence` holds the EF Core context, entity configurations, migrations,
  and the startup initialiser; `Markdown` holds the Markdig renderer. Templates are ordinary database
  rows (full CRUD); the six built-in starters are seeded by migration.
- `IPlantUmlRenderer` is the one deliberate seam, so integration tests can
  substitute a fake renderer and run without a JVM. It lives in Core and
  supports both SVG for the API and PNG for the CLI.

## Rendering Flow

1. The frontend submits PlantUML source to the SignalR hub method `RenderDiagram`.
2. The hub validates the source inline (non-empty, at most 100k characters).
3. The hub calls the renderer with the connection's abort token, so a render for a disconnected client is cancelled and its process killed.
4. The renderer starts the vendored PlantUML JAR through the configured Java executable.
5. PlantUML receives source through standard input and returns SVG bytes through standard output.
6. The API maps the Core result to its existing SVG-or-error response contract.

The CLI follows the same path but requests PNG bytes and writes them to the
selected output file only after rendering succeeds.

Rendering is bounded by a timeout and a concurrency limiter so render bursts cannot create unbounded Java processes.

## Persistence

Documents are stored in SQLite through Entity Framework Core. The default connection string writes to an `App_Data` database path. The E2E environment resets and migrates the database on startup so Playwright runs begin from a clean state.

## Frontend Structure

The Angular application is organized around:

- `core` services and models (HTTP, SignalR, Monaco loading, layout preferences, File System Access).
- `features/editor` for the Monaco editor, toolbar rail, save dialog, resize divider, and diagram preview. The editor page owns document loading directly from the URL's `documentId` — there is no route resolver or custom route-reuse strategy.
- `features/documents` for the saved-documents side panel (list, open, rename, delete).
- `features/explorer` for browsing and editing local folders via the File System Access API.
- `features/templates` for the Templates side panel (apply, create/update from the editor, rename, delete).
- `shared` components for reusable status, loading, and error UI.

Development uses relative `/api` and `/hubs` URLs with the Angular proxy configuration. Production environment values are expected to be supplied by deployment configuration.

## Vendored Assets

Trellis.Core vendors PlantUML and C4-PlantUML assets and copies them transitively to API and CLI build/publish outputs so local workflows are deterministic. These components retain their upstream licenses and are documented in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

