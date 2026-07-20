# Vendored Renderer Assets

This directory contains third-party runtime assets used by Trellis.Core and copied to its application hosts:

- `plantuml/plantuml.jar` - PlantUML command-line renderer.
- `c4-plantuml/` - C4-PlantUML include files.
Update [plantuml/VERSION.txt](plantuml/VERSION.txt) whenever the PlantUML JAR changes. Also update the root [THIRD_PARTY_NOTICES.md](../../../../THIRD_PARTY_NOTICES.md) when any vendored dependency changes source, version, or license.

To inspect the license reported by the bundled PlantUML JAR:

```powershell
java -jar backend/src/Trellis.Core/Vendor/plantuml/plantuml.jar -license
```
