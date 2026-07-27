# Character Sheet Exporter

Character Sheet Exporter is a Foundry Virtual Tabletop module that turns a D&D 5e player character into a clean, standalone HTML character sheet. The user chooses a registered design, reviews the result in a separate print view, and uses the browser's normal **Print** command to print it or save it as PDF.

Version 1 intentionally does not create PDF files itself and has no PDF runtime dependency.

## Compatibility

- Foundry Virtual Tabletop 14 (verified target)
- Foundry Virtual Tabletop 13
- D&D Fifth Edition system 5.1.9 through 5.3.x
- Actor type `character` only

NPC export and systems other than `dnd5e` are not enabled in version 1. The adapter and template registries are designed to support them later without changing the renderer.

The implementation uses the v13/v14 `getActorContextOptions` hook, `foundry.applications.api.DialogV2`, `foundry.applications.handlebars.renderTemplate`, `game.actors`, `Actor#getRollData`, and `Document#testUserPermission` APIs. A small compatibility helper normalizes the ContextMenuEntry field and callback changes between Foundry v13 and v14, including v13 jQuery targets. The adapter supports the dnd5e 5.1.9 prepared data model as well as the 5.3 senses and spell-source representations. Dnd5e 5.1.9 is intended for Foundry v13; use the current dnd5e 5.3 release on Foundry v14.

## Installation

For local development or manual installation:

1. Place this repository in the Foundry user-data directory at `Data/modules/character-exporter`.
2. Restart Foundry VTT.
3. Enable **Character Sheet Exporter** in a dnd5e World's Manage Modules screen. The manifest's supported-system relationship prevents it from being offered to unrelated systems.

A packaged release can be installed from its manifest URL once the project is published. The repository does not invent a release URL in `module.json`.

## Using the exporter

1. Open the **Actors** directory.
2. Right-click a D&D 5e player character you own. Gamemasters can export any character.
3. Choose **Export Character**.
4. Select a compatible template and choose **Open Print View**.
5. Review the standalone sheet, then choose **Print**.
6. Use the browser print dialog, including **Save as PDF** when the browser provides it.

Allow pop-ups for the Foundry origin if the browser blocks the print view. Export is deliberately not printed automatically.

Two original templates are bundled:

- **Wayfarer Character Folio** is an A4 design with a compact play overview and naturally paginated details.
- **Classic Character Record** is a traditional Letter-size three-page summary followed by complete, naturally paginated equipment, feature, narrative, and spell appendices.

Both work in color and grayscale and preserve long character content rather than silently truncating it.

## Architecture

The key boundary is `CharacterExportData`:

```text
Foundry dnd5e Actor
        │
        ▼
Dnd5eCharacterAdapter
        │
        ▼
CharacterExportData schema v1
        │
        ▼
registered Handlebars + CSS template
        │
        ▼
standalone HTML print view
        │
        ▼
browser Print / Save as PDF
```

Templates never receive an Actor, Item, Collection, `actor.system`, or the result of `actor.toObject()`. All knowledge of dnd5e field paths is isolated in `scripts/adapters/dnd5e-character-adapter.js`. The renderer only understands a registered template and CharacterExportData.

Important components:

- `AdapterRegistry` selects a system/Actor-type converter.
- `Dnd5eCharacterAdapter` reads prepared dnd5e values and emits normalized plain data.
- `TemplateRegistry` validates, versions, lists, and unregisters template plugins.
- `HtmlTemplateRenderer` enforces exact schema compatibility and calls Foundry's Handlebars renderer.
- `TemplateSelectionDialog` uses DialogV2 and opens the popup directly from the confirmation click.
- `PrintView` writes the standalone document and adds non-printing Print/Close controls.
- `game.modules.get("character-exporter").api` exposes the intentional extension surface.

The full schema contract is in [docs/character-export-data-schema.md](docs/character-export-data-schema.md).

## Public API

The module exposes:

```js
const exporter = game.modules.get("character-exporter")?.api;

exporter.registerTemplate(definition, { replace: false });
exporter.unregisterTemplate(id);
exporter.getTemplates({ schemaVersion: 1, renderer: "html" });

// Advanced adapter extension points:
exporter.registerAdapter(id, adapter, { priority: 0, replace: false });
exporter.unregisterAdapter(id);
```

`api.apiVersion` versions the JavaScript API. `api.schemaVersion` reports the current CharacterExportData version. These versions are independent of the module's release version.

### Registering a template from another module

Register during `ready`, when this module's API has already been installed:

```js
Hooks.once("ready", () => {
  const exporter = game.modules.get("character-exporter")?.api;
  if (!exporter) return;

  exporter.registerTemplate({
    id: "my-folio.clean",
    name: "Clean Character Folio",
    description: "A compact two-column print design.",
    author: "My Module Team",
    version: "1.0.0",
    schemaVersion: 1,
    renderer: "html",
    template: "modules/my-folio/templates/clean-sheet.hbs",
    stylesheets: ["modules/my-folio/styles/clean-sheet.css"],
    page: {
      size: "A4",
      orientation: "portrait"
    },
    sourceModule: "my-folio"
  });
});
```

Template IDs share one registry; prefix them with the providing module ID. Registration rejects duplicates unless the caller explicitly passes `{ replace: true }`.

Asset paths must be Foundry package paths beginning with `modules/` or `systems/`. Protocol URLs, data URLs, and `..` segments are rejected. Paths are resolved from the Foundry page origin; relative URLs inside a linked stylesheet resolve relative to that stylesheet as normal. Images emitted by a template should use Foundry-resolvable asset paths. The Actor portrait is already provided as `character.portrait`.

The optional `character-exporter.ready` hook fires after the bundled template has registered:

```js
Hooks.once("character-exporter.ready", api => {
  console.debug(api.getTemplates());
});
```

See [docs/template-authoring.md](docs/template-authoring.md) for a complete template-module structure and contract.

## Template format

The built-in metadata file demonstrates the on-disk format:

```json
{
  "id": "default",
  "name": "Wayfarer Character Folio",
  "description": "A printable A4 folio.",
  "author": "Example Author",
  "version": "1.0.0",
  "schemaVersion": 1,
  "renderer": "html",
  "template": "sheet.hbs",
  "stylesheet": "sheet.css",
  "page": { "size": "A4", "orientation": "portrait" }
}
```

Relative `template` and `stylesheet` values are a convenience used by the bundled metadata loader. Third-party calls to `registerTemplate` use full `modules/...` or `systems/...` paths. `stylesheets` may be used instead of `stylesheet` to load more than one CSS file.

Foundry's existing Handlebars environment is used. The module registers four namespaced helpers:

- `characterExporterSigned value` — formats `3` as `+3`.
- `characterExporterJoin values` — joins strings or objects with a `name` property.
- `characterExporterHas value` — tests whether a collection-like normalized value is non-empty.
- `characterExporterEqual left right` — compares values for level/group filtering without relying on an unnamespaced Foundry helper.

Business rules belong in an adapter, not a template. A template's root context is exactly CharacterExportData.

## Schema and compatibility policy

`schemaVersion` starts at `1`. Additive fields can be introduced while preserving the version. A removal, rename, semantic change, or incompatible type change requires a new integer schema version. Templates declare exactly one expected schema version and incompatible templates are omitted from selection and rejected by the renderer.

The schema version does not follow the module's semantic version. A module release may leave the schema unchanged, and a future module release can support more than one schema through explicit migration or adapters.

System internals are never silently added to the public root. Narrow system-specific semantics live under `extensions.dnd5e`; raw system documents are not exported there either.

## Privacy and security

The print view contains the selected Actor's character data and is created on the same Foundry origin. It does not upload data or contact a PDF service. Rich Actor and Item HTML is passed through Foundry's HTML cleaner and stripped of executable/embed elements and inline event handlers before entering the export contract.

Templates are trusted assets installed by a Foundry administrator. Metadata cannot execute JavaScript, and the exporter does not use `eval` or `Function` constructors.

## Copyright

This module does **not** bundle, trace, or reproduce official Wizards of the Coast character-sheet artwork or assets. Wayfarer and Classic are original HTML/CSS designs created for this exporter. The Classic template uses generic record-sheet conventions and carries no official logo or claimed Wizards of the Coast authorship. D&D and related marks belong to their respective owners; no affiliation or endorsement is implied.

## Development

No runtime JavaScript dependencies are required.

```bash
npm test
npm run check
```

The tests use Node's built-in test runner and cover normalization, signed modifiers, schema validation, adapter selection, template registration and compatibility, v13/v14 context-menu dispatch, DialogV2 selection, standalone print controls, end-to-end export-service delivery, HTML renderer boundaries, and representative multiclass dnd5e 5.1.9/5.3 conversions. The project checker validates manifests, required files, template metadata, forbidden Actor/system access in sheet templates, and unsafe dynamic execution patterns.

Because Foundry VTT itself is proprietary and is not bundled in this repository, automated tests do not boot a complete Foundry client. Final release verification should also be performed in a Foundry v13/dnd5e 5.1.9 World and a Foundry v14/dnd5e 5.3 World using characters with multiclassing, containers, 2014 and 2024 rules, prepared spells, long feature descriptions, and a blocked-popup test.

## Known version 1 limits

- D&D 5e `character` Actors only; NPCs are intentionally excluded.
- Browser HTML printing is the only PDF path.
- User-uploaded template ZIP files are not supported; templates come from installed modules/systems.
- Exact browser page breaks can vary by print engine. Content is preserved and allowed to flow instead of being force-fit or truncated.
