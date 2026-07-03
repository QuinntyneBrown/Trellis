# Defect & Change Log

This folder tracks issues found and changes requested while manually exercising
the running app, ahead of turning them into tracked work (issues, specs, or
direct fixes).

## How to use

Add entries to [log.md](log.md) as you find them. Each entry gets an ID,
a type, and a status. Keep descriptions short — enough for someone to
reproduce or understand the request without re-reading the whole app.

- **Defect** — something is broken relative to expected behavior.
- **Change** — something works as built but should work differently
  (UX tweak, wording, behavior change, etc.).

## Entry format

```markdown
### D-001 — Short title
- **Type:** Defect | Change
- **Area:** e.g. Editor, Explorer, Rendering, Auth
- **Status:** Open | Fixed | Won't Fix
- **Steps to reproduce:** (defects only)
  1. ...
  2. ...
- **Expected:**
- **Actual:**
- **Notes:**
```

Number IDs sequentially (`D-001`, `D-002`, ...) regardless of whether the
entry is a defect or a change — one running sequence keeps references
unambiguous.

Once an entry is triaged into a fix or a spec, link the PR/commit or spec
doc under **Notes** and update **Status**.
