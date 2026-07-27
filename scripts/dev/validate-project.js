import { readFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";

const requiredFiles = [
  "module.json",
  "README.md",
  "LICENSE",
  "lang/en.json",
  "scripts/main.js",
  "templates/dialogs/template-selection.hbs",
  "templates/sheets/default/template.json",
  "templates/sheets/default/sheet.hbs",
  "templates/sheets/default/sheet.css",
  "styles/module.css",
  "docs/character-export-data-schema.md",
  "docs/template-authoring.md"
];

for (const file of requiredFiles) await access(file, fsConstants.R_OK);

const manifest = JSON.parse(await readFile("module.json", "utf8"));
const language = JSON.parse(await readFile("lang/en.json", "utf8"));
const template = JSON.parse(await readFile("templates/sheets/default/template.json", "utf8"));

if (manifest.id !== "character-exporter") throw new Error("module.json id must be character-exporter");
if (manifest.type !== "module") throw new Error("module.json type must be module");
if (!Array.isArray(manifest.media)) throw new Error("module.json media must be an array");
if (!manifest.esmodules?.includes("scripts/main.js")) throw new Error("module.json must load scripts/main.js");
if (Number(manifest.compatibility?.minimum) !== 13 || Number(manifest.compatibility?.verified) !== 14) {
  throw new Error("module.json must declare Foundry 13 minimum and Foundry 14 verified");
}
if ("system" in manifest) throw new Error("module.json must not use the legacy top-level system field");
if (!manifest.relationships?.systems?.some((system) => system.id === "dnd5e")) {
  throw new Error("module.json must declare dnd5e in relationships.systems");
}
if (!language["CHARACTER-EXPORTER"]) throw new Error("English localization namespace is missing");
if (template.schemaVersion !== 1 || template.renderer !== "html") {
  throw new Error("Built-in template must target CharacterExportData schema 1 and the HTML renderer");
}

const sheet = await readFile("templates/sheets/default/sheet.hbs", "utf8");
if (/\bactor(?:\.|\b)/iu.test(sheet) || /\bsystem\./iu.test(sheet)) {
  throw new Error("Sheet templates must not access Actor or system internals");
}

const scriptFiles = [
  "scripts/main.js",
  "scripts/adapters/dnd5e-character-adapter.js",
  "scripts/export/html-template-renderer.js",
  "scripts/ui/print-view.js"
];
for (const file of scriptFiles) {
  const source = await readFile(file, "utf8");
  if (/\beval\s*\(|new\s+Function\b/u.test(source)) throw new Error(`Unsafe dynamic execution found in ${file}`);
}

const css = await readFile("templates/sheets/default/sheet.css", "utf8");
for (const requiredRule of ["@page", "@media print", "break-inside", "break-before"]) {
  if (!css.includes(requiredRule)) throw new Error(`Built-in print CSS is missing ${requiredRule}`);
}

console.log(`Validated ${requiredFiles.length} required files, manifests, schema metadata, template isolation, and print CSS.`);
