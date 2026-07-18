# Changelog

All notable changes to Trellis are recorded in this file.

## Unreleased

### Added

- Full-text document search from the title bar's Quick Open: typing a query
  now also searches document *content* in the database (a new
  `GET /api/documents/search` endpoint), not just names. Content-only hits
  appear below the name matches, each with a snippet of the body around the
  match; the request is debounced and name filtering stays instant.
- Folder "Explain This": a Documents-explorer folder row command that
  aggregates every document in the folder and its subfolders server-side
  into an LLM-ready "Explain This" prompt, downloads the referenced source
  attachment, and loads the prompt into the editor as an unsaved markdown
  document. PlantUML documents map to `.puml` source files and markdown
  documents to `.md`, so the prompt and attachment match a local-folder or
  repository selection; every document is included regardless of its
  export-exclusion flag (backed by a new `GET /api/explain/folder/{id}`
  endpoint).
- Per-document export exclusion: a document row toggle marks a document as
  excluded from folder markdown exports (shown as a "no export" badge and
  a dimmed name in the tree). The folder export action now opens a dialog
  whose "Include documents excluded from export" checkbox overrides the
  per-document setting for that one export.
- Folder export: a Documents-explorer folder row action that aggregates
  every PlantUML and Markdown document in the folder and its subfolders
  into one markdown file downloaded by the browser as `<folder-name>.md` —
  only document content is included (no folder or document names),
  PlantUML sources are fenced as ```` ```plantuml ```` blocks, and
  markdown content is inlined verbatim.
- Templates explorer side panel with full template CRUD: create from the
  current editor content, apply, update-from-editor, rename, and delete.
  The six built-in starters are migration-seeded, editable rows.
- Markdown document support: documents and templates carry a kind
  (PlantUML or Markdown); markdown renders server-side to sanitized HTML
  through the same pipeline behaviors as PlantUML.
- Initial professional open-source documentation set.
- Root project README, contribution guidance, security policy, support policy, governance notes, maintainer and contributor files, and third-party notices.

### Changed

- New, Save, and Upload moved from the activity rail into the title bar's
  now-functional File menu, with Alt+N (New) and Ctrl+U (Upload) keyboard
  shortcuts joining Ctrl+S / Ctrl+Shift+S. The rail keeps the panel
  toggles and connection status.
- The Templates rail icon now opens a side panel (VS Code-style, exclusive
  with the Explorer and Documents panels) instead of a pop-out picker; the
  panel stays open when a template is applied.

