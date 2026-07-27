import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { BUILT_IN_TEMPLATE_METADATA_PATHS, MODULE_ID } from "../scripts/constants.js";
import {
  loadBuiltInTemplate,
  resolveBuiltInTemplateAssets
} from "../scripts/export/built-in-template-loader.js";
import { normalizeTemplateDefinition } from "../scripts/export/template-registry.js";

test("every bundled template resolves its own assets and satisfies registry validation", async () => {
  const definitions = [];
  for (const metadataPath of BUILT_IN_TEMPLATE_METADATA_PATHS) {
    const localPath = metadataPath.replace(`modules/${MODULE_ID}/`, "");
    const metadata = JSON.parse(await readFile(localPath, "utf8"));
    definitions.push(normalizeTemplateDefinition(resolveBuiltInTemplateAssets(metadata, metadataPath)));
  }

  assert.deepEqual(definitions.map(definition => definition.id), ["default", "classic"]);
  assert.equal(new Set(definitions.map(definition => definition.id)).size, definitions.length);
  assert.match(definitions[1].template, /templates\/sheets\/wotc\/sheet\.hbs$/u);
  assert.match(definitions[1].stylesheets[0], /templates\/sheets\/wotc\/sheet\.css$/u);
  assert.equal(definitions[1].page.size, "Letter");
  assert.equal(definitions[1].version, "1.1.0");
});

test("bundled metadata loader reports missing assets and resolves successful responses", async () => {
  const path = BUILT_IN_TEMPLATE_METADATA_PATHS[1];
  const metadata = JSON.parse(await readFile("templates/sheets/wotc/template.json", "utf8"));
  const loaded = await loadBuiltInTemplate(path, async receivedPath => ({
    ok: receivedPath === path,
    status: 200,
    async json() { return metadata; }
  }));
  assert.equal(loaded.id, "classic");

  await assert.rejects(
    loadBuiltInTemplate(path, async () => ({ ok: false, status: 404 })),
    /Unable to load built-in template metadata/u
  );
});
