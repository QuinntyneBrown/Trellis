# Trellis Frontend

The Trellis frontend is an Angular 17 application for editing PlantUML source, rendering diagrams in real time, managing saved documents, and starting from built-in templates.

## Development

Install dependencies:

```powershell
npm ci
```

Start the development server:

```powershell
npm start
```

Open `http://localhost:4200`.

The dev server uses [proxy.conf.json](proxy.conf.json) to proxy `/api` and `/hubs` to the backend at `http://localhost:5000`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Angular dev server. |
| `npm run build` | Build the production frontend. |
| `npm run watch` | Build in watch mode with development configuration. |
| `npm test` | Run Jest tests. |
| `npm run test:watch` | Run Jest in watch mode. |

## Structure

- `src/app/core` - API services, models, routing, and resolvers.
- `src/app/features/editor` - Monaco editor, toolbar, save dialog, and diagram preview.
- `src/app/features/documents` - saved document list and document item UI.
- `src/app/features/templates` - template picker.
- `src/app/shared` - reusable status, loading, and error components.
