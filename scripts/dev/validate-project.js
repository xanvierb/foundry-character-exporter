import { readFile, access, readdir } from "node:fs/promises";
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
  "templates/sheets/wotc/template.json",
  "templates/sheets/wotc/sheet.hbs",
  "templates/sheets/wotc/sheet.css",
  "styles/module.css",
  "docs/character-export-data-schema.md",
  "docs/template-authoring.md"
];

for (const file of requiredFiles) await access(file, fsConstants.R_OK);

const manifest = JSON.parse(await readFile("module.json", "utf8"));
const packageMetadata = JSON.parse(await readFile("package.json", "utf8"));
const language = JSON.parse(await readFile("lang/en.json", "utf8"));

if (manifest.id !== "character-exporter") throw new Error("module.json id must be character-exporter");
if (packageMetadata.version !== manifest.version) {
  throw new Error("package.json and module.json versions must match");
}
if (manifest.download && !manifest.download.includes(`/tags/${manifest.version}.zip`)) {
  throw new Error("module.json download URL must match the module version tag");
}
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
const dnd5eRelationship = manifest.relationships.systems.find((system) => system.id === "dnd5e");
if (dnd5eRelationship.compatibility?.minimum !== "5.1.9") {
  throw new Error("module.json must declare dnd5e 5.1.9 as the minimum supported system version");
}
if (!language["CHARACTER-EXPORTER"]) throw new Error("English localization namespace is missing");
const sheetDirectories = (await readdir("templates/sheets", { withFileTypes: true }))
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)
  .sort();
const templateIds = new Set();
function assertBalancedHandlebars(source, name) {
  const stack = [];
  for (const match of source.matchAll(/\{\{([#/])(if|unless|each)\b/gu)) {
    const [, direction, block] = match;
    if (direction === "#") stack.push(block);
    else if (stack.pop() !== block) throw new Error(`${name} contains an unbalanced Handlebars ${block} block`);
  }
  if (stack.length) throw new Error(`${name} contains unclosed Handlebars blocks: ${stack.join(", ")}`);
}

for (const directory of sheetDirectories) {
  const base = `templates/sheets/${directory}`;
  const template = JSON.parse(await readFile(`${base}/template.json`, "utf8"));
  if (template.schemaVersion !== 1 || template.renderer !== "html") {
    throw new Error(`${directory} template must target CharacterExportData schema 1 and the HTML renderer`);
  }
  if (templateIds.has(template.id)) throw new Error(`Duplicate built-in template id: ${template.id}`);
  templateIds.add(template.id);
  await access(`${base}/${template.template}`, fsConstants.R_OK);
  const stylesheets = template.stylesheets ?? (template.stylesheet ? [template.stylesheet] : []);
  for (const stylesheet of stylesheets) await access(`${base}/${stylesheet}`, fsConstants.R_OK);

  const sheet = await readFile(`${base}/${template.template}`, "utf8");
  assertBalancedHandlebars(sheet, directory);
  if (/\bactor(?:\.|\b)/iu.test(sheet) || /\bsystem\./iu.test(sheet)) {
    throw new Error(`${directory} sheet template must not access Actor or system internals`);
  }

  for (const stylesheet of stylesheets) {
    const css = await readFile(`${base}/${stylesheet}`, "utf8");
    for (const requiredRule of ["@page", "@media print", "break-inside", "break-before"]) {
      if (!css.includes(requiredRule)) throw new Error(`${directory} print CSS is missing ${requiredRule}`);
    }
  }
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

console.log(
  `Validated ${requiredFiles.length} required files and ${sheetDirectories.length} built-in templates, `
  + "including manifests, schema metadata, template isolation, and print CSS."
);
