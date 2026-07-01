# Third-party Notices

This file summarizes third-party software that is vendored in the repository or central to the Trellis runtime. It is provided for convenience and does not replace the applicable license texts.

The Trellis project license applies only to original Trellis source code and documentation unless a file states otherwise. Third-party components remain under their own licenses.

## Vendored Runtime Assets

| Component | Location | License | Source |
| --- | --- | --- | --- |
| PlantUML `1.2026.6` | `backend/src/Trellis.Api/Vendor/plantuml/plantuml.jar` | GNU General Public License, version 3 or later, as reported by the bundled JAR's `-license` command. | https://github.com/plantuml/plantuml/releases/download/v1.2026.6/plantuml-1.2026.6.jar |
| C4-PlantUML | `backend/src/Trellis.Api/Vendor/c4-plantuml/` | MIT License | https://github.com/plantuml-stdlib/C4-PlantUML |

PlantUML licensing information is published at https://plantuml.com/license and https://plantuml.com/faq. C4-PlantUML publishes its license in the upstream repository at https://github.com/plantuml-stdlib/C4-PlantUML/blob/master/LICENSE.

## Package-managed Dependencies

NuGet dependencies are declared in [backend/Directory.Packages.props](backend/Directory.Packages.props) and project files under `backend/src` and `backend/tests`.

npm dependencies are declared in [frontend/package.json](frontend/package.json), [frontend/package-lock.json](frontend/package-lock.json), [e2e/package.json](e2e/package.json), and [e2e/package-lock.json](e2e/package-lock.json).

Review package manager metadata before redistributing a modified dependency set.

