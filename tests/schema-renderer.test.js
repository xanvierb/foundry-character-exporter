import test from "node:test";
import assert from "node:assert/strict";

import {
  CharacterExportDataError,
  assertCharacterExportData,
  isSchemaCompatible
} from "../scripts/export/character-export-data.js";
import {
  HtmlTemplateRenderer,
  TemplateCompatibilityError
} from "../scripts/export/html-template-renderer.js";

function minimalData() {
  return {
    schemaVersion: 1,
    character: { name: "Ada" },
    abilities: {},
    combat: {},
    skills: [],
    senses: [],
    proficiencies: {},
    attacks: [],
    inventory: [],
    features: [],
    spellcasting: {},
    spells: [],
    resources: [],
    currency: {},
    notes: {},
    extensions: {}
  };
}

test("schema construction validation and compatibility are exact", () => {
  assert.equal(assertCharacterExportData(minimalData()).character.name, "Ada");
  assert.equal(isSchemaCompatible(1, 1), true);
  assert.equal(isSchemaCompatible(1, 2), false);
  assert.throws(() => assertCharacterExportData({ ...minimalData(), schemaVersion: 2 }), CharacterExportDataError);
  assert.throws(() => assertCharacterExportData({ ...minimalData(), skills: {} }), /Expected an array/u);
});

test("HTML renderer passes only CharacterExportData as the Handlebars root", async t => {
  const previousFoundry = globalThis.foundry;
  t.after(() => {
    globalThis.foundry = previousFoundry;
  });
  const data = minimalData();
  let receivedPath;
  let receivedData;
  globalThis.foundry = {
    applications: {
      handlebars: {
        renderTemplate: async (path, root) => {
          receivedPath = path;
          receivedData = root;
          return `<h1>${root.character.name}</h1>`;
        }
      }
    }
  };

  const renderer = new HtmlTemplateRenderer();
  const template = {
    id: "test.clean",
    schemaVersion: 1,
    renderer: "html",
    template: "modules/test/clean.hbs",
    stylesheets: ["modules/test/clean.css"],
    page: { size: "A4" }
  };
  const result = await renderer.render(template, data);
  assert.equal(receivedPath, template.template);
  assert.equal(receivedData, data);
  assert.equal(result.html, "<h1>Ada</h1>");
  assert.deepEqual(result.stylesheets, ["modules/test/clean.css"]);

  await assert.rejects(
    renderer.render({ ...template, schemaVersion: 2 }, data),
    TemplateCompatibilityError
  );
});
