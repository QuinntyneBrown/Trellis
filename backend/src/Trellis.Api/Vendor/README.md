# Vendored Renderer Assets

This directory contains third-party runtime assets used by the Trellis API:

- `plantuml/plantuml.jar` - PlantUML command-line renderer.
- `c4-plantuml/` - C4-PlantUML include files.
- `templates/` - Trellis starter templates and manifest.

Update [plantuml/VERSION.txt](plantuml/VERSION.txt) whenever the PlantUML JAR changes. Also update the root [THIRD_PARTY_NOTICES.md](../../../../THIRD_PARTY_NOTICES.md) when any vendored dependency changes source, version, or license.

To inspect the license reported by the bundled PlantUML JAR:

```powershell
java -jar backend/src/Trellis.Api/Vendor/plantuml/plantuml.jar -license
```

