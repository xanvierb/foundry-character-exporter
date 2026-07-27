# Authoring a template module

A template provider is an ordinary Foundry module containing Handlebars, CSS, and a small registration script. It does not import Character Sheet Exporter internals and does not read a dnd5e Actor.

## Suggested structure

```text
my-folio/
  module.json
  scripts/register.js
  templates/clean-sheet.hbs
  styles/clean-sheet.css
```

Its `module.json` should declare `character-exporter` as a required module relationship and load `scripts/register.js` as an ES module. A minimal registration script is:

```js
Hooks.once("ready", () => {
  const exporter = game.modules.get("character-exporter")?.api;
  if (!exporter) {
    ui.notifications.error("Character Sheet Exporter is not available.");
    return;
  }

  exporter.registerTemplate({
    id: "my-folio.clean",
    name: "Clean Character Folio",
    description: "A compact two-column sheet.",
    author: "My Module Team",
    version: "1.0.0",
    schemaVersion: 1,
    renderer: "html",
    template: "modules/my-folio/templates/clean-sheet.hbs",
    stylesheets: ["modules/my-folio/styles/clean-sheet.css"],
    page: { size: "A4", orientation: "portrait" },
    sourceModule: "my-folio"
  });
});
```

Use a globally unique, module-prefixed lowercase `id`. A template version is semantic (`1.0.0`) and describes the template package; it is separate from `schemaVersion`.

## Handlebars contract

The Handlebars root is exactly the normalized object documented in [character-export-data-schema.md](character-export-data-schema.md). For example:

```hbs
<article class="my-folio">
  <h1>{{character.name}}</h1>
  <p>
    {{localize "MY-FOLIO.Level"}} {{character.level}}
    · {{characterExporterSigned character.proficiencyBonus}}
  </p>

  {{#each skills}}
    <div class="skill">
      <strong>{{characterExporterSigned modifier}}</strong> {{name}}
    </div>
  {{/each}}
</article>
```

Do not access `actor`, `actor.system`, `Item`, Foundry Collections, or dnd5e field paths. Those values are not in the context. If the normalized schema lacks a generally useful semantic field, propose an additive schema change rather than coupling a template to system internals.

Rich descriptions and biographies are cleaned HTML strings. Render them with triple braces only where markup is desired, for example `{{{description}}}`. Other values should use normal escaped braces.

## Print CSS

Each stylesheet is linked into the standalone document, not copied into the Foundry shell. Include explicit print rules:

```css
@page {
  size: A4 portrait;
  margin: 10mm;
}

.entry,
table tr {
  break-inside: avoid-page;
}

thead {
  display: table-header-group;
}

@media print {
  .my-folio {
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
}
```

Use natural document flow. Avoid fixed-height text boxes, line clamping, `overflow: hidden`, and assumptions about feature/spell counts. `break-before`, `break-after`, and `break-inside` are useful hints, but browsers remain the final pagination engine.

The print view supplies its own Print/Close toolbar and removes it under `@media print`; templates do not need controls or scripts.

The declared `page.size` (`A4` or `Letter`) and `page.orientation` also size the standalone on-screen preview. The template stylesheet remains responsible for its matching `@page` rule.

Available namespaced helpers are `characterExporterSigned`, `characterExporterJoin`, `characterExporterHas`, `characterExporterEqual`, and `characterExporterAtLeast`. Prefer these over unnamespaced helpers whose availability can vary with the Foundry environment.

## Paths and assets

Registration paths must begin with `modules/` or `systems/`. The registry rejects protocol URLs, data URLs, and traversal segments. Relative URLs in CSS resolve relative to the CSS file. Template image paths should be Foundry-resolvable package paths. The character portrait is available at `character.portrait` and may be absent.

## Compatibility and lifecycle

Character Sheet Exporter currently selects templates whose integer `schemaVersion` exactly matches the produced data. Inspect `exporter.schemaVersion` before registering if a module supports multiple definitions:

```js
if (exporter.schemaVersion === 1) exporter.registerTemplate(schemaOneDefinition);
```

To remove a template during development or module teardown:

```js
game.modules.get("character-exporter")?.api?.unregisterTemplate("my-folio.clean");
```

The registry returns frozen public copies of definitions. Registering arbitrary renderer callbacks or JavaScript in template metadata is intentionally unsupported.
