# Changelog

All notable changes to Trellis are recorded in this file.

## Unreleased

### Added

- Folder export: a Documents-explorer folder row action that aggregates
  every PlantUML and Markdown document in the folder and its subfolders
  into one markdown file downloaded by the browser as `<folder-name>.md` —
  headings mirror the folder hierarchy, PlantUML sources are fenced as
  ```` ```plantuml ```` blocks, and markdown content is inlined verbatim.
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

