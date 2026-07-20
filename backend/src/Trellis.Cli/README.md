# Trellis CLI

Trellis CLI renders local PlantUML source files to PNG using a bundled
PlantUML JAR and C4-PlantUML includes. A Java runtime must be available as
`java` on `PATH`.

## Install

```powershell
dotnet tool install --global Trellis.Cli
```

## Usage

Render a `.puml` file to an adjacent `.png` file:

```powershell
trellis render path/to/diagram.puml
```

Choose an output path with `--output` or `-o`:

```powershell
trellis render path/to/diagram.puml --output path/to/diagram.png
```

Existing output files are replaced only after PlantUML renders successfully.

## Configuration

Set `PlantUml__JavaExecutablePath` when Java is not available as `java` on
`PATH`. Rendering timeout and concurrency can be overridden with
`PlantUml__RenderTimeoutSeconds` and `PlantUml__MaxConcurrentRenders`.

Source, issue tracking, and additional documentation are available in the
[Trellis repository](https://github.com/QuinntyneBrown/Trellis).
